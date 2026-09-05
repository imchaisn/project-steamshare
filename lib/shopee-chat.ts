/**
 * Shopee Seller Chat client — delivers the "your code is ready" message to
 * the buyer inside Shopee's own chat, as the last step of the automated
 * fulfilment pipeline (push webhook -> order detail -> listing mapping ->
 * account allocation -> orders row -> THIS).
 *
 * Web Crypto only, transitively: every byte of signing happens inside
 * lib/shopee-auth.ts (signShopRequest), which uses globalThis.crypto.subtle.
 * Nothing here imports node:crypto, so this module stays runnable on both
 * the Edge and Node runtimes — same constraint as lib/auth.ts.
 *
 * ── WHY THIS MODULE NEVER THROWS ─────────────────────────────────────────
 * The thing that actually entitles a buyer to their code is the `orders`
 * row, not this message. gameshare.space works the instant that row exists;
 * the chat message is a convenience that tells the buyer the row is there.
 * So a Shopee chat outage, a revoked chat permission, or a rate-limit storm
 * must degrade to "buyer has to find the link themselves", never to "the
 * webhook 500s, Shopee retries, and we risk a duplicate orders row". Every
 * failure path below returns { sent: false, detail } instead of throwing.
 * The caller's job is to record that detail (orders.delivery_error) and
 * move on — see lib/fulfillment.ts.
 *
 * ── WHAT IS AND IS NOT VERIFIED HERE ─────────────────────────────────────
 * Everything about *how a Shopee shop-scoped call is made* — host, the
 * partner_id/timestamp/access_token/shop_id query params, the
 * partner_id+path+timestamp+access_token+shop_id sign formula, and the
 * `{ error, message, request_id, response }` envelope — is verified: it is
 * lifted from lib/shopee-auth.ts, which was written against Shopee's own
 * docs (see its header for citations).
 *
 * The Seller Chat API surface — api_path, body field names, and how you get
 * from an order to a chat recipient — WAS unverified and is now confirmed,
 * as of 2026-09-05, by probing the live API rather than reading a doc page.
 * See SHOPEE_SELLERCHAT_API below for the evidence.
 *
 * The recipient problem turned out to have a much better answer than any of
 * the four candidates originally sketched in resolveChatRecipient(): a chat
 * message is addressed to the buyer's numeric user id, and
 * v2.order.get_order_detail hands that id over directly as `buyer_user_id`.
 * So the caller already holds it — there is no lookup, no conversation
 * matching, and no requirement that a conversation already exist.
 * resolveChatRecipient() survives only as an unused fallback.
 *
 * This module still never reports sent: true for a call it did not make.
 */

import { getStoredShopToken, getValidAccessToken, signShopRequest } from "@/lib/shopee-auth";

// ─────────────────────────────────────────────────────────────────────────
// THE SELLER CHAT SURFACE (confirmed 2026-09-05)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The complete Shopee Seller Chat surface, in one place.
 *
 * The api_path and every body field name below were originally guesses,
 * deliberately parameterised here so they could be labelled as guesses
 * rather than buried in a fetch call. They have now all been confirmed
 * against the live API — the guesses happened to be right, but "right" and
 * "verified" are different things, and only the second one is safe to build
 * on. Keeping the shape means a future Shopee change is still a one-object
 * edit.
 *
 * ── STILL NOT ESTABLISHED, and deliberately not guessed ─────────────────
 *  - The maximum length of a single chat text message. NOT enforced below
 *    on purpose: silently truncating a delivery message could cut the
 *    gameshare.space link (or the password) off the end, which is worse
 *    than a rejected send we can see in delivery_error.
 *  - Any per-shop chat rate limit. MIN_CALL_INTERVAL_MS is best-effort
 *    insurance, not a limiter derived from a published number.
 *
 * ── WHAT SHOPEE'S OWN RULES ADD ─────────────────────────────────────────
 * A shop may only message a buyer inside a contact window — Shopee's
 * wording, seen live: "You can only message the buyer if they start a
 * conversation with you within 7 days, place an order within 30 days, or
 * ...". Automated delivery is well inside it; a manual resend of an old
 * order is not. See the user_is_forbidden handling in sendBuyerMessage.
 */
export const SHOPEE_SELLERCHAT_API = {
  /**
   * VERIFIED 2026-09-05 against the LIVE production shop, not a
   * doc page. Every value below was confirmed by probing the real API:
   *
   *   GET  /api/v2/sellerchat/get_conversation_list  -> 200, real data
   *   GET  /api/v2/sellerchat/get_unread_conversation_count -> 200
   *   POST /api/v2/sellerchat/send_message  -> error "invalid_to_id"
   *   POST /api/v2/sellerchat/<nonsense>    -> error "error_not_found"
   *
   * The control matters: a path that does not exist answers
   * "error_not_found", and send_message did NOT — it complained about the
   * CONTENT of the request instead, which is only possible if the route
   * exists and the partner has the chat scope. That last point also settles
   * item 4 of the old TODO list: this app does have Chat API access.
   *
   * Field names came from the live message schema returned by
   * /api/v2/sellerchat/get_message, which renders stored messages as
   *   { from_id, to_id, message_type: "text", content: { text: "..." }, ... }
   * and from a body-shape probe: `content` as a bare string is rejected with
   * "param_error", while `content: { text }` is accepted. Hence
   * nestTextUnderContent stays true — that is measured, not assumed.
   */
  verified: true,

  send: {
    /**
     * Confirmed live. Still env-overridable so ops can repoint it during an
     * incident without a deploy, same as before.
     */
    path: process.env.SHOPEE_SELLERCHAT_SEND_PATH ?? "/api/v2/sellerchat/send_message",
    conversationIdField: "conversation_id",
    /** Confirmed: sending with no to_id fails with error "invalid_to_id". */
    toIdField: "to_id",
    messageTypeField: "message_type",
    /** Confirmed: live messages carry message_type "text". */
    textMessageType: "text",
    /** Confirmed nested: a flat string content is rejected as "param_error". */
    contentField: "content",
    textField: "text",
    nestTextUnderContent: true,
  },

  recipientLookup: {
    /** UNVERIFIED — see resolveChatRecipient(). null = recipient cannot be resolved. */
    path: process.env.SHOPEE_SELLERCHAT_RECIPIENT_PATH ?? null,
    /** UNVERIFIED query param used to address the lookup by order. */
    orderSnParam: "order_sn",
    /** UNVERIFIED response field names to read the recipient out of. */
    conversationIdField: "conversation_id",
    buyerUserIdField: "to_id",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Host + transport
// ─────────────────────────────────────────────────────────────────────────

/**
 * API host for shop-scoped calls.
 *
 * DELIBERATE DUPLICATION of lib/shopee-auth.ts's TOKEN_HOST: that constant
 * is module-private there and this file is not allowed to edit that file.
 * The two must stay in step — if the host ever changes there, change it
 * here too. Both are overridable by env so a mismatch is fixable without a
 * deploy.
 */
const IS_SANDBOX = (process.env.SHOPEE_ENV ?? "sandbox") !== "live";
const API_HOST =
  process.env.SHOPEE_API_HOST ??
  (IS_SANDBOX
    ? "https://openplatform.sandbox.test-stable.shopee.sg"
    : "https://partner.shopeemobile.com");

/** Per-request wall clock budget. Shopee's push retry window is 300s; we
 *  must be nowhere near that, because the webhook is waiting on us. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Minimum spacing between outbound Shopee calls from this process.
 *
 * Best-effort only: on Vercel each serverless instance has its own module
 * state, so this throttles a burst inside one instance (e.g. a backlog of
 * retried pushes landing together), not the fleet. It is cheap insurance
 * against tripping Shopee's per-shop rate limit and turning a delivery into
 * a 429; it is not a distributed rate limiter and is not claimed to be one.
 */
const MIN_CALL_INTERVAL_MS = 250;

/** Bounded retry budget — see the retry-policy comment on callShopeeChatApi. */
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
/** Never sleep longer than this between retries, even if Shopee's
 *  Retry-After asks for more — the webhook caller is blocked on us. */
const MAX_BACKOFF_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let callChain: Promise<unknown> = Promise.resolve();
let lastCallStartedAt = 0;

/**
 * Serialise outbound calls through a promise chain and space them by
 * MIN_CALL_INTERVAL_MS. Concurrent callers queue rather than burst.
 */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const gate = callChain.then(async () => {
    const waitMs = MIN_CALL_INTERVAL_MS - (Date.now() - lastCallStartedAt);
    if (waitMs > 0) await sleep(waitMs);
    lastCallStartedAt = Date.now();
  });
  // Keep the chain alive even if a caller's fn rejects.
  callChain = gate.catch(() => undefined);
  return gate.then(fn);
}

/**
 * Shopee's standard response envelope. Confirmed shape — lib/shopee-auth.ts
 * keys its own error handling off the same `error` / `message` fields.
 */
interface ShopeeEnvelope {
  error?: string;
  message?: string;
  request_id?: string;
  response?: unknown;
}

/**
 * Why a call failed, in the only two dimensions that matter for retrying:
 * whether it is worth trying again, and whether the message might already
 * have been delivered.
 */
interface CallFailure {
  ok: false;
  /** Safe to send the exact same request again. */
  retryable: boolean;
  /** We cannot tell whether Shopee processed the message. NEVER auto-retry. */
  ambiguous: boolean;
  detail: string;
  retryAfterMs?: number;
}

interface CallSuccess {
  ok: true;
  data: ShopeeEnvelope;
}

type CallOutcome = CallSuccess | CallFailure;

/** Redact anything credential-shaped before it can reach a log or a DB column. */
function redact(text: string): string {
  return text.replace(/(access_token|sign|partner_key)=[^&\s]+/gi, "$1=[redacted]");
}

/**
 * Perform one signed, shop-scoped Shopee call.
 *
 * The query-string layout (partner_id, timestamp, access_token, shop_id,
 * sign) and the signing formula are the verified parts — identical to what
 * lib/shopee-auth.ts does for every post-token-exchange call.
 */
async function callShopeeOnce(
  path: string,
  accessToken: string,
  shopId: number,
  init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown },
): Promise<CallOutcome> {
  let url: string;
  try {
    const { timestamp, sign } = await signShopRequest(path, accessToken, shopId);
    const params = new URLSearchParams({
      partner_id: process.env.SHOPEE_PARTNER_ID ?? "",
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: String(shopId),
      sign,
      ...(init.query ?? {}),
    });
    url = `${API_HOST}${path}?${params.toString()}`;
  } catch (err) {
    // signShopRequest throws only on missing SHOPEE_PARTNER_ID/KEY — a
    // config fault, identical on every retry.
    return {
      ok: false,
      retryable: false,
      ambiguous: false,
      detail: `Shopee chat request could not be signed: ${redact(errText(err))}`,
    };
  }

  // Manual AbortController rather than AbortSignal.timeout() so this does
  // not depend on a newer DOM lib than tsconfig's target guarantees.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (timedOut) {
      // AMBIGUOUS ON PURPOSE. A client-side timeout tells us nothing about
      // whether Shopee accepted and delivered the message — it may well
      // have. Retrying here is the one thing that could double-send a
      // delivery message to a buyer, so we don't. We surface it instead.
      return {
        ok: false,
        retryable: false,
        ambiguous: true,
        detail: `Shopee chat call to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms; delivery state unknown, not retried to avoid double-sending`,
      };
    }
    // Connection-level failure (DNS, refused, reset) — the request did not
    // reach Shopee's application layer, so replaying it cannot duplicate.
    return {
      ok: false,
      retryable: true,
      ambiguous: false,
      detail: `Shopee chat call to ${path} failed at the transport layer: ${redact(errText(err))}`,
    };
  }
  clearTimeout(timer);

  const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));

  if (res.status === 429 || res.status === 503) {
    // Rejected by the edge/limiter before the chat message was created —
    // the one class of HTTP error that is provably safe to replay.
    return {
      ok: false,
      retryable: true,
      ambiguous: false,
      detail: `Shopee chat call to ${path} was rate-limited or unavailable (HTTP ${res.status})`,
      retryAfterMs,
    };
  }

  if (res.status >= 500) {
    // 500/502/504: Shopee may have processed the send and failed on the way
    // back. Ambiguous, so not retried — same reasoning as the timeout.
    return {
      ok: false,
      retryable: false,
      ambiguous: true,
      detail: `Shopee chat call to ${path} returned HTTP ${res.status}; delivery state unknown, not retried to avoid double-sending`,
    };
  }

  let bodyText: string;
  try {
    bodyText = await res.text();
  } catch (err) {
    return {
      ok: false,
      retryable: false,
      ambiguous: true,
      detail: `Shopee chat call to ${path} returned HTTP ${res.status} but the body could not be read: ${redact(errText(err))}`,
    };
  }

  let data: ShopeeEnvelope;
  try {
    data = JSON.parse(bodyText) as ShopeeEnvelope;
  } catch {
    return {
      ok: false,
      retryable: false,
      ambiguous: res.ok,
      detail: `Shopee chat call to ${path} returned HTTP ${res.status} with a non-JSON body: ${redact(bodyText).slice(0, 300)}`,
    };
  }

  // Shopee reports application errors inside a 200 with a non-empty
  // `error` string (confirmed convention — lib/shopee-auth.ts keys off the
  // same field). These are deterministic: wrong path, missing scope, bad
  // param, unknown conversation. Retrying cannot fix any of them.
  if (data.error) {
    return {
      ok: false,
      retryable: false,
      ambiguous: false,
      detail: `Shopee rejected the chat call to ${path}: ${data.error}${data.message ? ` — ${data.message}` : ""}${data.request_id ? ` (request_id ${data.request_id})` : ""}`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      retryable: false,
      ambiguous: false,
      detail: `Shopee chat call to ${path} returned HTTP ${res.status} with no error field: ${redact(bodyText).slice(0, 300)}`,
    };
  }

  return { ok: true, data };
}

/**
 * ── RETRY POLICY (deliberate, and narrower than it looks) ────────────────
 *
 * The requirement pulls in two directions: one blip of packet loss must not
 * cost a buyer their delivery message, but a buyer must never receive the
 * same message twice. Those only reconcile if retries are restricted to
 * failures where we can PROVE the request never reached Shopee's
 * application layer. So:
 *
 *   RETRIED (proof of non-delivery):
 *     - fetch() rejected before a response — DNS/connect/reset. Nothing was
 *       processed.
 *     - HTTP 429 / 503. Rejected by the limiter/edge, not the chat service.
 *
 *   NOT RETRIED (ambiguous — could already be delivered):
 *     - our own client timeout
 *     - HTTP 500 / 502 / 504
 *     These return ambiguous: true so the caller can record "unknown" in
 *     delivery_error rather than "failed". Choosing a possibly-missing
 *     message over a possibly-duplicated one is intentional: the buyer can
 *     always reach their code at gameshare.space, so a missing convenience
 *     message costs far less than a confusing duplicate.
 *
 *   NOT RETRIED (deterministic):
 *     - any Shopee `error` in the envelope, any 4xx other than 429. Same
 *       request, same answer.
 *
 * Bounded at MAX_RETRIES (2 extra attempts) with jittered exponential
 * backoff capped at MAX_BACKOFF_MS, because a Shopee push webhook is
 * blocked on this call and Shopee's own delivery timeout is what triggers
 * the 300s/1800s/10800s push retry storm we are trying to avoid.
 *
 * FINALLY, THE HONEST CAVEAT: this function is at-most-once only for the
 * classes above. The hard, system-level "exactly one message per order"
 * guarantee is NOT here and cannot be — it lives in the caller, which must
 * check orders.delivered_at before calling and set it after. This module
 * is the transport; the ledger is the orders row.
 */
async function callShopeeChatApi(
  path: string,
  accessToken: string,
  shopId: number,
  init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown },
): Promise<CallOutcome> {
  let last: CallOutcome = {
    ok: false,
    retryable: false,
    ambiguous: false,
    detail: `Shopee chat call to ${path} was never attempted`,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    last = await throttled(() => callShopeeOnce(path, accessToken, shopId, init));
    if (last.ok) return last;
    if (!last.retryable) return last;
    if (attempt === MAX_RETRIES) break;

    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    const jitter = Math.floor(Math.random() * 250);
    const waitMs = Math.min(last.retryAfterMs ?? backoff, MAX_BACKOFF_MS) + jitter;
    await sleep(waitMs);
  }

  return {
    ...(last as CallFailure),
    detail: `${(last as CallFailure).detail} (gave up after ${MAX_RETRIES + 1} attempts)`,
  };
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return undefined;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ─────────────────────────────────────────────────────────────────────────
// Shop id resolution
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve which shop_id to sign as.
 *
 * signShopRequest() needs a concrete shop_id, but getValidAccessToken()
 * takes an optional one and quietly picks "the single row on file" when it
 * is omitted. To keep those two consistent we resolve the id from the same
 * stored row first, then ask getValidAccessToken() for a fresh token for
 * exactly that shop. That is one extra read of shopee_auth per delivery —
 * cheap, and it means we can never sign with one shop's id and another
 * shop's token if a second shop is ever authorized.
 *
 * Exported for testability.
 */
export async function resolveShopId(shopId?: number): Promise<number | null> {
  if (typeof shopId === "number" && Number.isFinite(shopId)) return shopId;

  const fromEnv = Number(process.env.SHOPEE_SHOP_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  try {
    const stored = await getStoredShopToken();
    return stored?.shopId ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// THE RECIPIENT PROBLEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a Shopee chat message is addressed. Kept as a discriminated union
 * because the two candidate strategies below produce different address
 * types, and whichever one research picks, the send builder handles both
 * without changing shape.
 */
export type ChatRecipient =
  | { kind: "conversation"; conversationId: string }
  | { kind: "buyer_user_id"; toId: number };

export interface ResolveChatRecipientResult {
  recipient: ChatRecipient | null;
  /** Human-readable reason, suitable for orders.delivery_error. */
  detail: string;
}

/**
 * Resolve an order_sn to a chat recipient.
 *
 * ── WHY THIS IS ITS OWN FUNCTION ─────────────────────────────────────────
 * Shopee chat is not addressed to an order. It is addressed to a
 * conversation, or to a buyer user id. We start from an order_sn, which is
 * neither. That join is the single most likely thing in this module to need
 * rework once research lands, so it is isolated here: sendBuyerMessage()
 * consumes a ChatRecipient and does not care how it was obtained, and this
 * function can be swapped or unit-tested on its own.
 *
 * ── CANDIDATE APPROACHES FOUND, NONE CONFIRMED ───────────────────────────
 *  (a) A dedicated lookup that takes an order_sn and returns the
 *      conversation. Cleanest if it exists; would be exactly one call. No
 *      authoritative evidence that such an endpoint exists.
 *  (b) buyer_user_id from the order itself. v2.order.get_order_detail is
 *      known to gate extra fields behind a response_optional_fields query
 *      param, and a buyer user id is plausibly one of them — that id would
 *      then be the chat `to_id`. RISK: Shopee masks buyer PII in MY/SG
 *      order responses, which is the very reason the agreed orders schema
 *      has shopee_buyer_id becoming nullable. If the id is masked or
 *      absent, this route is dead. Note this would also make chat delivery
 *      depend on lib/shopee-api.ts, which today returns no buyer id — that
 *      contract would have to be extended.
 *  (c) List conversations for the shop and match. A third-party wrapper
 *      confirms a chat module keyed by `conversation_id` exists, so a
 *      conversation-list endpoint almost certainly does too. But nothing
 *      indicates a conversation carries an order_sn, so "match" would mean
 *      matching on buyer username — fuzzy, racy on a busy shop, and
 *      O(conversations) per delivery. Last resort.
 *  (d) Reply into the conversation Shopee itself opens on purchase. Would
 *      require the push payload or the chat webhook to carry the
 *      conversation id; our shopee_push_log rows will show whether it does,
 *      and that is the cheapest thing to check first once real pushes land.
 *
 * Until one of those is confirmed, this function fails loudly rather than
 * guessing. It is wired for (a): give it a path via
 * SHOPEE_SELLERCHAT_RECIPIENT_PATH and it will call it with the configured
 * order_sn param and read the configured fields out of the response.
 */
export async function resolveChatRecipient(
  orderSn: string,
  shopId: number,
  accessToken: string,
): Promise<ResolveChatRecipientResult> {
  const { path, orderSnParam, conversationIdField, buyerUserIdField } =
    SHOPEE_SELLERCHAT_API.recipientLookup;

  if (!path) {
    return {
      recipient: null,
      detail:
        "Shopee chat recipient lookup is UNVERIFIED: no endpoint is configured for resolving an order_sn to a conversation. " +
        "Shopee chat is addressed to a conversation or a buyer user id, never to an order. " +
        "Confirm the real endpoint (see the candidate approaches in the resolveChatRecipient() docblock in lib/shopee-chat.ts), " +
        "then set SHOPEE_SELLERCHAT_API.recipientLookup.path or the SHOPEE_SELLERCHAT_RECIPIENT_PATH env var.",
    };
  }

  const outcome = await callShopeeChatApi(path, accessToken, shopId, {
    method: "GET",
    query: { [orderSnParam]: orderSn },
  });

  if (!outcome.ok) {
    return { recipient: null, detail: `Could not resolve a chat recipient for order ${orderSn}: ${outcome.detail}` };
  }

  // Tolerant extraction: we do not know whether the recipient sits at the
  // top level of `response`, inside it, or as the first element of a list,
  // so probe the plausible containers rather than assume one and crash.
  const containers = candidateObjects(outcome.data.response);

  for (const obj of containers) {
    const conversationId = obj[conversationIdField];
    if (typeof conversationId === "string" && conversationId.length > 0) {
      return { recipient: { kind: "conversation", conversationId }, detail: "resolved by conversation id" };
    }
    if (typeof conversationId === "number" && Number.isFinite(conversationId)) {
      // Carried as a string from here on. Shopee ids routinely exceed 2^53,
      // and JSON.parse will already have rounded such a value — stringifying
      // at least stops us rounding it a SECOND time on the way back out.
      // If conversation ids do turn out to exceed 2^53 in practice, this
      // whole lookup needs a bigint-safe JSON parse, not a patch here.
      return {
        recipient: { kind: "conversation", conversationId: String(conversationId) },
        detail: "resolved by conversation id",
      };
    }
  }

  for (const obj of containers) {
    const toId = obj[buyerUserIdField];
    if (typeof toId === "number" && Number.isFinite(toId)) {
      return { recipient: { kind: "buyer_user_id", toId }, detail: "resolved by buyer user id" };
    }
    if (typeof toId === "string" && /^\d+$/.test(toId)) {
      return { recipient: { kind: "buyer_user_id", toId: Number(toId) }, detail: "resolved by buyer user id" };
    }
  }

  return {
    recipient: null,
    detail:
      `Shopee chat recipient lookup for order ${orderSn} succeeded but contained neither ` +
      `"${conversationIdField}" nor "${buyerUserIdField}" — the configured response field names in ` +
      `SHOPEE_SELLERCHAT_API.recipientLookup are unverified guesses and are probably wrong.`,
  };
}

/** Plausible places a recipient object could sit inside an unknown `response`. */
function candidateObjects(response: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const push = (v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(v as Record<string, unknown>);
  };

  push(response);
  if (Array.isArray(response)) response.forEach(push);
  if (response && typeof response === "object" && !Array.isArray(response)) {
    for (const value of Object.values(response as Record<string, unknown>)) {
      push(value);
      if (Array.isArray(value)) value.forEach(push);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export interface SendBuyerMessageParams {
  /** Shopee order_sn. Used for logging and as the fallback lookup handle. */
  orderSn: string;
  /** Message body — build it with buildDeliveryMessage() in lib/fulfillment.ts. */
  text: string;
  /** Omit for Steamshare's single shop; resolved from shopee_auth. */
  shopId?: number;
  /**
   * The buyer's Shopee user id, which is what a chat message is actually
   * addressed to. THIS IS THE PREFERRED PATH and the caller should always
   * supply it.
   *
   * v2.order.get_order_detail returns it as `buyer_user_id` when asked for
   * in response_optional_fields, so the webhook already holds it by the time
   * it wants to send — no extra API call, no conversation matching, no
   * dependence on the buyer having messaged us first. Verified live on
   * 2026-09-05: a real order returned a buyer_user_id, and
   * that id appears in get_conversation_list as the `to_id` of the
   * conversation with that same buyer.
   *
   * When omitted, sendBuyerMessage falls back to resolveChatRecipient(),
   * which needs an endpoint that is still unconfigured — so in practice
   * omitting this means the send fails with an actionable message.
   */
  buyerUserId?: number;
}

export interface SendBuyerMessageResult {
  /** true ONLY when Shopee accepted the send. Never optimistic. */
  sent: boolean;
  /** Reason / context. Safe to persist to orders.delivery_error verbatim. */
  detail: string;
  /**
   * Contract extension (optional, so existing `{ sent, detail }` consumers
   * are unaffected): true when we genuinely cannot tell whether the buyer
   * got the message. Treat as "do not auto-resend"; a human should check
   * the Shopee chat thread before anything re-sends.
   */
  ambiguous?: boolean;
}

/**
 * Send the delivery message to the buyer of `orderSn` in Shopee chat.
 *
 * Never throws — see the module header. Every failure comes back as
 * { sent: false, detail }, and every failure is also console.error'd so a
 * chat outage is visible in the Vercel logs and not only in a DB column.
 *
 * IDEMPOTENCY IS THE CALLER'S JOB. Shopee retries pushes at
 * 300s/1800s/10800s, so the same order_sn will arrive here more than once
 * unless something upstream stops it. This function has no memory: call it
 * twice and it sends twice. Guard it with orders.delivered_at.
 */
export async function sendBuyerMessage(
  params: SendBuyerMessageParams,
): Promise<SendBuyerMessageResult> {
  const { orderSn, text, shopId, buyerUserId } = params;

  try {
    if (!orderSn || !orderSn.trim()) {
      return { sent: false, detail: "No order_sn supplied; refusing to send a chat message." };
    }
    if (!text || !text.trim()) {
      return {
        sent: false,
        detail: `Refusing to send an empty chat message for order ${orderSn} — this is a bug in the caller, not a Shopee failure.`,
      };
    }

    // ── FAIL LOUD ON THE UNVERIFIED SEAM ────────────────────────────────
    // Reached only if someone wires this up before the research lands.
    // It must be impossible to mistake this for a successful delivery.
    const sendPath = SHOPEE_SELLERCHAT_API.send.path;
    if (!sendPath) {
      return fail(
        orderSn,
        "Shopee Seller Chat send endpoint is UNVERIFIED and unset, so no message was sent. " +
          "Nothing was delivered to the buyer — the buyer can still redeem at gameshare.space using their Shopee Order ID. " +
          "TO FIX: confirm the real api_path for sending a seller->buyer chat message, plus the request body field names " +
          "(conversation vs buyer-user-id addressing, the plain-text message_type literal, and whether the text is nested " +
          "under content), then fill in SHOPEE_SELLERCHAT_API.send in lib/shopee-chat.ts and flip its `verified` flag. " +
          "SHOPEE_SELLERCHAT_SEND_PATH can unblock the path alone without a deploy, but the field names still need a human check.",
      );
    }

    const resolvedShopId = await resolveShopId(shopId);
    if (resolvedShopId === null) {
      return fail(
        orderSn,
        "No authorized Shopee shop on file, so the chat message could not be signed or sent. " +
          "Complete the shop authorization flow (/api/admin/shopee/auth-url) or set SHOPEE_SHOP_ID.",
      );
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(resolvedShopId);
    } catch (err) {
      // Token refresh is the most likely recurring failure here: the
      // refresh_token is single-use and rotates, so a lost race leaves the
      // shop needing re-authorization. Say so plainly.
      return fail(
        orderSn,
        `Could not obtain a valid Shopee access token for shop ${resolvedShopId}: ${redact(errText(err))}. ` +
          "If this persists the shop probably needs re-authorizing.",
      );
    }

    /**
     * Address the message.
     *
     * The buyer_user_id the caller hands us IS the chat `to_id` — verified
     * live, see SendBuyerMessageParams.buyerUserId. That makes the whole
     * "resolve an order to a conversation" problem disappear on the happy
     * path: zero extra API calls, and no dependence on a conversation
     * already existing.
     *
     * resolveChatRecipient() is kept only as the fallback for a caller that
     * cannot supply the id. It still needs a configured endpoint and will
     * fail with an actionable message if used.
     */
    let recipient: ChatRecipient;
    if (typeof buyerUserId === "number" && Number.isFinite(buyerUserId) && buyerUserId > 0) {
      recipient = { kind: "buyer_user_id", toId: buyerUserId };
    } else {
      const resolved = await resolveChatRecipient(orderSn, resolvedShopId, accessToken);
      if (!resolved.recipient) {
        return fail(
          orderSn,
          `${resolved.detail} NOTE: the caller did not supply buyerUserId, which is the ` +
            `supported path — pass it from get_order_detail's buyer_user_id instead of ` +
            `relying on this lookup.`,
        );
      }
      recipient = resolved.recipient;
    }

    const body = buildSendBody(recipient, text);
    const outcome = await callShopeeChatApi(sendPath, accessToken, resolvedShopId, {
      method: "POST",
      body,
    });

    if (!outcome.ok) {
      /**
       * SHOPEE'S CONTACT WINDOW — the one business rule that will look like
       * a bug and is not one.
       *
       * Probed live 2026-09-05, Shopee's own wording:
       *   "You can only message the buyer if they start a conversation with
       *    you within 7 days, place an order within 30 days, or ..."
       *
       * Automated delivery fires seconds after payment, so it is never near
       * this limit. A MANUAL RESEND OF AN OLD ORDER IS. Anyone re-sending a
       * message for an order older than 30 days will get user_is_forbidden
       * and should not go looking for a broken token or a wrong to_id — the
       * integration is fine, Shopee is refusing on policy. In that case the
       * buyer still redeems at gameshare.space with their Order ID; there is
       * no chat route to them any more.
       */
      const forbidden = /user_is_forbidden/i.test(outcome.detail);
      const result: SendBuyerMessageResult = {
        sent: false,
        detail: outcome.ambiguous
          ? `${outcome.detail}. Treat as UNKNOWN, not failed: do not auto-resend, check the Shopee chat thread for order ${orderSn} first.`
          : forbidden
            ? `${outcome.detail} This is Shopee's contact-window policy, NOT a broken integration: a shop may only message a buyer within 30 days of their order (or 7 days of them messaging first). Nothing is wrong with the token or the recipient id. Direct the buyer to gameshare.space with their Order ID instead.`
            : outcome.detail,
        ambiguous: outcome.ambiguous,
      };
      console.error(`[shopee-chat] delivery not confirmed for order ${orderSn}: ${result.detail}`);
      return result;
    }

    const requestId = outcome.data.request_id ? ` (request_id ${outcome.data.request_id})` : "";
    return {
      sent: true,
      detail: `Delivery message sent to the buyer of order ${orderSn} via Shopee chat${requestId}.`,
    };
  } catch (err) {
    // Absolute last line of defence. Nothing above is expected to throw,
    // but the webhook must survive this module unconditionally: losing the
    // orders row to a chat bug would cost the buyer their purchase, while
    // losing the message only costs them a link they can find themselves.
    return fail(orderSn, `Unexpected error in the Shopee chat client: ${redact(errText(err))}`);
  }
}

function fail(orderSn: string, detail: string): SendBuyerMessageResult {
  console.error(`[shopee-chat] delivery failed for order ${orderSn}: ${detail}`);
  return { sent: false, detail };
}

/**
 * Build the send request body from the configured (UNVERIFIED) field names.
 * Isolated so that landing the research means editing
 * SHOPEE_SELLERCHAT_API.send and, at most, this one function.
 */
function buildSendBody(recipient: ChatRecipient, text: string): Record<string, unknown> {
  const cfg = SHOPEE_SELLERCHAT_API.send;
  const body: Record<string, unknown> = {
    [cfg.messageTypeField]: cfg.textMessageType,
    [cfg.contentField]: cfg.nestTextUnderContent ? { [cfg.textField]: text } : text,
  };

  if (recipient.kind === "conversation") {
    body[cfg.conversationIdField] = recipient.conversationId;
  } else {
    body[cfg.toIdField] = recipient.toId;
  }

  return body;
}
