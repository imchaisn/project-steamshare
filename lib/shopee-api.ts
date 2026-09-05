/**
 * Shopee Open Platform V2 — Order API client.
 *
 * One job: turn an `ordersn` (what the push webhook hands us) into the order
 * facts the fulfillment pipeline needs — status, buyer username, pay time,
 * and the purchased item/model ids that map to one of our games.
 *
 * Signing, token storage and token refresh are NOT reimplemented here.
 * lib/shopee-auth.ts already owns all of that; this module only calls
 * getValidAccessToken() and signShopRequest().
 *
 * SOURCES (checked 2026-09-03, because AGENTS.md forbids writing this from
 * memory and a plausible-but-wrong Shopee endpoint is worse than an obvious
 * gap):
 *   - v2.order.get_order_detail official doc page:
 *     https://open.shopee.com/documents/v2/v2.order.get_order_detail?module=94&type=1
 *     open.shopee.com refuses non-browser clients from this environment, so
 *     the field names below were cross-checked against three independent SDKs
 *     that transcribe that page verbatim, not read off the page itself.
 *   - congminh1254/shopee-sdk `src/schemas/order.ts` — TypeScript schema that
 *     quotes the doc's own parameter descriptions inline, including the
 *     buyer_username masking note and the request_order_status_pending text.
 *     https://github.com/congminh1254/shopee-sdk/blob/main/src/schemas/order.ts
 *   - congminh1254/shopee-sdk `docs/managers/order.md` — the full
 *     response_optional_fields table copied from that doc page.
 *     https://github.com/congminh1254/shopee-sdk/blob/main/docs/managers/order.md
 *   - passwind/go-shopee-v2 `order.go` — confirms this is a GET with both
 *     params in the QUERY STRING (struct tags are `url:"order_sn_list"` /
 *     `url:"response_optional_fields"`, issued through the client's Get()),
 *     and confirms order_list is nested under a top-level "response" key.
 *     https://github.com/passwind/go-shopee-v2/blob/main/order.go
 *
 * Anything those sources did not agree on, or did not cover at all, is marked
 * TODO(unconfirmed) below rather than guessed.
 */

import { getValidAccessToken, getStoredShopToken, signShopRequest } from "@/lib/shopee-auth";

const IS_SANDBOX = (process.env.SHOPEE_ENV ?? "sandbox") !== "live";

/**
 * API host for shop-scoped V2 calls.
 *
 * THE DUPLICATION IS DELIBERATE: lib/shopee-auth.ts holds the identical pair
 * of hosts as a private `TOKEN_HOST` and does not export it. Editing that file
 * to export it was out of scope here (another agent may be reading it), so the
 * value is repeated. FOLLOW-UP: shopee-auth.ts should export its host constant
 * and this module should import it, otherwise the sandbox/live switch can
 * drift between the two files and produce signature errors that look like
 * credential problems.
 *
 * Both hosts are the ones shopee-auth.ts already uses for token exchange; the
 * Order API is served from the same host as the token API.
 */
export const SHOPEE_API_HOST = IS_SANDBOX
  ? "https://openplatform.sandbox.test-stable.shopee.sg"
  : "https://partner.shopeemobile.com";

/**
 * The api_path. This exact string is BOTH the URL path and the `api_path`
 * component of the HMAC base string inside signShopRequest() — they must stay
 * identical or every call fails signature verification with an opaque error.
 */
const GET_ORDER_DETAIL_PATH = "/api/v2/order/get_order_detail";

/**
 * Optional response fields we ask for — exactly what the pipeline consumes,
 * nothing more. Every name here appears in the doc's response_optional_fields
 * table (see docs/managers/order.md in the sources above):
 *
 *   buyer_username — the second factor the buyer types at gameshare.space.
 *   item_list      — carries item_id + model_id, which shopee_listings maps to
 *                    one of our games. Without it the order is unusable.
 *   pay_time       — doc description, quoted: "The time when the order status
 *                    is updated from UNPAID to PAID". This is the single most
 *                    trustworthy paid/not-paid signal available to us, more so
 *                    than the status string (see describePaymentState below).
 *
 * NOT requested on purpose: recipient_address, buyer_cpf_id, credit_card_number,
 * dropshipper_phone and the rest. That is buyer PII we have no use for, and
 * pulling PII we do not need is pure liability.
 *
 * `order_status` is deliberately absent: the doc's response_optional_fields
 * table does not list it, because it is part of the always-returned base order
 * object. One low-quality secondary source claimed order_status is an optional
 * field; the primary transcription of the table does not list it, and sending
 * an unrecognised optional-field name is a known way to get an opaque error
 * back. So we do not send it — and instead fail loudly in normalizeOrder() if
 * the response comes back without order_status.
 *
 * buyer_user_id was ADDED 2026-09-05, and it is not PII creep — it is the
 * address a Shopee chat message is sent to. /api/v2/sellerchat/send_message
 * takes a `to_id`, and that id is exactly this value — confirmed on 2026-09-05
 * against a real live order, whose returned buyer_user_id matched the `to_id`
 * of that buyer's conversation in get_conversation_list. Requesting it here
 * is what lets lib/shopee-chat.ts address the delivery message with no extra
 * API call and no conversation matching. It is a numeric account id, not a
 * name, an email or an address.
 */
const RESPONSE_OPTIONAL_FIELDS = [
  "buyer_user_id",
  "buyer_username",
  "item_list",
  "pay_time",
] as const;

/**
 * Doc description, quoted: "Compatible parameter during migration period, send
 * True will let API support PENDING status".
 *
 * We send true ON PURPOSE. A PENDING order is one whose payment Shopee is still
 * verifying — Shopee's own seller education describes a PENDING order as
 * undergoing verification, with confirmation within 24h
 * (https://seller.shopee.com.my/edu/article/10691/managing-pending-orders).
 * If we do NOT opt in, we do not know which status Shopee collapses those
 * orders into, and mistaking one for paid means handing out a Steam password
 * for money that may never arrive. Opting in makes the ambiguous case visible
 * as its own string that describePaymentState() can refuse.
 *
 * TODO(unconfirmed): Shopee calls this a migration-period parameter, so it may
 * eventually be removed or become the default. If get_order_detail ever starts
 * rejecting it, drop it here and re-check what PENDING orders report instead.
 */
const REQUEST_ORDER_STATUS_PENDING = true;

/** Shopee is a third party on the public internet; never hang a webhook on it. */
const REQUEST_TIMEOUT_MS = 15_000;

/* ------------------------------------------------------------------------ */
/* Errors                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Why one class with a `kind` instead of six Error subclasses: the caller (the
 * push webhook / fulfillment retry loop) has to decide "retry later" vs "this
 * will never work, stop retrying", and a switch on a string union expresses
 * that without instanceof chains across module boundaries.
 *
 *   auth         — could not obtain or refresh an access token. NOT fixable by
 *                  retrying the same call; a human must re-authorize the shop.
 *   network      — fetch itself threw, or the request timed out. Retryable.
 *   http         — non-2xx with no parseable Shopee error payload. Retryable.
 *   malformed    — HTTP 200 but the body is not the shape the doc describes.
 *                  NOT retryable: it means this file's assumptions are wrong,
 *                  and it must be visible rather than silently absorbed.
 *   shopee_error — HTTP 200 with a non-empty top-level `error` field. Whether
 *                  it is retryable depends on the code, which is why the raw
 *                  `error` string is preserved verbatim on the instance.
 *   not_found    — the call succeeded but order_list held no entry for the
 *                  ordersn we asked about. Unknown ordersn, or wrong shop.
 */
export type ShopeeApiErrorKind =
  | "auth"
  | "network"
  | "http"
  | "malformed"
  | "shopee_error"
  | "not_found";

export class ShopeeApiError extends Error {
  readonly kind: ShopeeApiErrorKind;
  /** The ordersn the failing call was about, so logs stay greppable per order. */
  readonly orderSn: string | null;
  /** Shopee's machine-readable `error` code, verbatim. Null unless kind is "shopee_error". */
  readonly shopeeError: string | null;
  /** Shopee's human-readable `message`, verbatim. */
  readonly shopeeMessage: string | null;
  /** Shopee's `request_id` — the only handle Shopee support will accept in a ticket. */
  readonly requestId: string | null;
  /** HTTP status, when there was a response at all. */
  readonly httpStatus: number | null;

  constructor(
    kind: ShopeeApiErrorKind,
    message: string,
    details: {
      orderSn?: string | null;
      shopeeError?: string | null;
      shopeeMessage?: string | null;
      requestId?: string | null;
      httpStatus?: number | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ShopeeApiError";
    this.kind = kind;
    this.orderSn = details.orderSn ?? null;
    this.shopeeError = details.shopeeError ?? null;
    this.shopeeMessage = details.shopeeMessage ?? null;
    this.requestId = details.requestId ?? null;
    this.httpStatus = details.httpStatus ?? null;
    // Assigned rather than passed to super(): the ErrorOptions overload needs
    // a newer lib target than this project's tsconfig ("target": "ES2017").
    if (details.cause !== undefined) {
      (this as { cause?: unknown }).cause = details.cause;
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Public types                                                              */
/* ------------------------------------------------------------------------ */

export interface ShopeeOrderItem {
  /** Shopee listing id. Pairs with modelId as the shopee_listings primary key. */
  itemId: number;
  /**
   * Variation id. Shopee omits or zeroes this for listings with no variations;
   * normalised to 0 here so it always matches shopee_listings.model_id, which
   * is `bigint not null default 0`.
   */
  modelId: number;
  itemName: string;
}

export interface ShopeeOrderDetail {
  orderSn: string;
  /** Raw status string, verbatim from Shopee. Do not compare it by hand — use isOrderPaid(). */
  orderStatus: string;
  /**
   * Usable buyer username, or null.
   *
   * null covers ALL THREE unusable cases — field absent, empty string, and
   * masked — deliberately, so code that only checks for null can never
   * accidentally store "j****n" as a buyer's login name or compare it against
   * what a buyer types. To tell the cases apart, read `buyerUsernameMasked`
   * and `buyerUsernameRaw`.
   */
  buyerUsername: string | null;
  /**
   * The buyer's numeric Shopee account id, or null if Shopee omitted it.
   *
   * This is the chat `to_id`: it is what /api/v2/sellerchat/send_message
   * addresses a message to, so it is the difference between being able to
   * message a buyer and not. Verified live 2026-09-05 against a real order:
   * its buyer_user_id was exactly the `to_id` of that buyer's
   * conversation).
   *
   * Nullable because it is an optional response field and, unlike item_list,
   * an order is still perfectly fulfillable without it — the buyer can always
   * redeem at gameshare.space using their Order ID. A null here must degrade
   * to "no chat message", never to "no order row".
   */
  buyerUserId: number | null;
  /**
   * True when Shopee returned a value but redacted it (it contains "*").
   *
   * This is the distinguishing signal for "there IS a buyer username, we are
   * just not allowed to see it". Downstream must then treat the Shopee
   * username as an UNAVAILABLE second factor — which is a different decision
   * from "this order has no buyer", and a different decision again from a
   * transport failure.
   */
  buyerUsernameMasked: boolean;
  /** Exactly what Shopee sent for buyer_username, for logs. Never show this to a buyer. */
  buyerUsernameRaw: string | null;
  /** Unix seconds. Null when Shopee did not return pay_time — i.e. never paid. */
  payTime: number | null;
  items: ShopeeOrderItem[];
}

/* ------------------------------------------------------------------------ */
/* Order status                                                              */
/* ------------------------------------------------------------------------ */

/**
 * Statuses an order can only reach AFTER money changed hands.
 *
 * CONFIRMED — present in the OrderStatus enum transcribed from the doc page by
 * congminh1254/shopee-sdk src/schemas/order.ts: READY_TO_SHIP, PROCESSED,
 * SHIPPED, COMPLETED, IN_CANCEL.
 *
 * IN_CANCEL is in this set because it means "cancellation REQUESTED on a paid
 * order", not "cancelled". CANCELLED lives in NEVER_PAID_STATUSES instead.
 */
const CONFIRMED_PAID_STATUSES = [
  "READY_TO_SHIP",
  "PROCESSED",
  "SHIPPED",
  "COMPLETED",
  "IN_CANCEL",
] as const;

/**
 * Also post-payment, but sourced only from a second-tier transcription (the Go
 * bindings at pkg.go.dev/github.com/wjp-letgo/shopeego/order, which list the
 * same enum plus these three). Kept in a separate constant so the confidence
 * difference stays visible in the code rather than only in a comment.
 *
 * All three are post-payment by construction — you cannot retry a shipment,
 * confirm receipt of goods, or open a return on an order that was never paid —
 * so including them cannot cause the DANGEROUS direction of error (granting
 * account access to an unpaid order). The worst case is that a status we
 * include here does not exist, in which case nothing ever matches it.
 */
const LIKELY_PAID_STATUSES = ["RETRY_SHIP", "TO_CONFIRM_RECEIVE", "TO_RETURN"] as const;

const PAID_STATUSES: ReadonlySet<string> = new Set<string>([
  ...CONFIRMED_PAID_STATUSES,
  ...LIKELY_PAID_STATUSES,
]);

/**
 * Statuses that definitively mean "do not deliver".
 *
 * UNPAID and CANCELLED are in the confirmed enum. PENDING is the status the
 * request_order_status_pending flag opts us into: payment under verification,
 * explicitly NOT settled.
 */
const NEVER_PAID_STATUSES: ReadonlySet<string> = new Set<string>([
  "UNPAID",
  "PENDING",
  "CANCELLED",
]);

export type ShopeePaymentState = "paid" | "unpaid" | "cancelled" | "unknown_status";

/**
 * Classify an order's payment state.
 *
 * HONESTY ABOUT WHAT IS AND IS NOT CONFIRMED. app/api/webhooks/shopee/route.ts
 * deliberately refused to guess this enum and said so in its docstring. This
 * function does not undo that discipline — it discharges part of it, and is
 * explicit about the part still outstanding:
 *
 *   - The enum values above ARE now sourced (see the two blocks above), not
 *     invented. But open.shopee.com blocks this environment, so they come from
 *     SDKs transcribing the doc page rather than from the page itself. That is
 *     one step removed from primary, which is exactly why an unrecognised
 *     status returns "unknown_status" instead of being optimistically bucketed.
 *   - The list is NOT proven exhaustive. Sources disagreed on the tail of the
 *     enum: INVOICE_PENDING appears in one transcription and not in the others.
 *     It is a Brazil-market invoicing state and is intentionally absent from
 *     BOTH sets here rather than guessed into one — a Malaysian shop should
 *     never see it, and if it ever appears it will surface as "unknown_status"
 *     and get looked at by a human.
 *   - So this function ALSO requires pay_time, whose doc description is
 *     unambiguous: "The time when the order status is updated from UNPAID to
 *     PAID". A status string we half-trust AND a timestamp Shopee only writes
 *     at payment is a much stronger conjunction than either signal alone.
 *
 * Net effect: "paid" requires BOTH a recognised paid status AND a pay_time.
 * Everything else degrades to a state the caller has to handle explicitly.
 */
export function describePaymentState(detail: ShopeeOrderDetail): ShopeePaymentState {
  const status = detail.orderStatus.trim().toUpperCase();

  if (status === "CANCELLED") return "cancelled";
  if (NEVER_PAID_STATUSES.has(status)) return "unpaid";
  if (!PAID_STATUSES.has(status)) return "unknown_status";

  // Recognised post-payment status but no pay_time: either Shopee withheld the
  // optional field, or our reading of the status is wrong. Either way it is not
  // a confident "paid", and this pipeline gives away a password on "paid", so
  // it refuses rather than delivers.
  if (detail.payTime === null || detail.payTime <= 0) return "unknown_status";

  return "paid";
}

/**
 * Is this order actually paid? Thin wrapper over describePaymentState().
 *
 * Returns true ONLY for the confident case. Read describePaymentState()'s doc
 * comment before relying on this: `false` here means "not confidently paid",
 * which lumps together genuinely unpaid, cancelled, and "Shopee returned a
 * status string this file has never heard of". Callers that need to tell
 * "wait and retry" apart from "give up permanently" must call
 * describePaymentState() directly.
 */
export function isOrderPaid(detail: ShopeeOrderDetail): boolean {
  return describePaymentState(detail) === "paid";
}

/* ------------------------------------------------------------------------ */
/* Wire types                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Shopee V2 wraps every response in this envelope: `error` and `message` sit at
 * the TOP level next to `response`, and a failure is reported with HTTP 200 and
 * a non-empty `error` string. Checking res.ok alone silently treats every
 * Shopee-level error as a success — see the ordering in getOrderDetail().
 */
interface ShopeeEnvelope {
  request_id?: string | null;
  error?: string | null;
  message?: string | null;
  warning?: string | null;
  response?: { order_list?: RawOrder[] | null } | null;
}

interface RawOrderItem {
  item_id?: number | string | null;
  model_id?: number | string | null;
  item_name?: string | null;
}

interface RawOrder {
  order_sn?: string | null;
  order_status?: string | null;
  buyer_username?: string | null;
  /** Typed as string too: Shopee returns some ids as strings, and a bigint id
   *  would already have been mangled by JSON.parse if it exceeded 2^53. */
  buyer_user_id?: number | string | null;
  pay_time?: number | string | null;
  item_list?: RawOrderItem[] | null;
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Shopee redacts buyer PII by substituting asterisks. The doc's own note on
 * buyer_username reads "will be masked as '****' if it is a non-integrated
 * order in TW region", and the endpoint-level note reads "Different parameters
 * might be masked according to each market and kind of seller."
 *
 * Neither statement tells us what Shopee does for a Malaysian shop, so this
 * detects the mask by SHAPE rather than by market: Shopee usernames are
 * alphanumerics plus "." and "_" and cannot contain "*", so any asterisk in the
 * value means we are looking at a redaction — whether a full "****" or a
 * partial "jo****an".
 */
function isMaskedValue(value: string): boolean {
  return value.includes("*");
}

/** Shopee is inconsistent about numeric-vs-string ids across markets; accept both. */
function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickErrorText(envelope: ShopeeEnvelope): string {
  const parts = [envelope.error, envelope.message].filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  return parts.length > 0 ? parts.join(" — ") : "(no error text supplied by Shopee)";
}

/* ------------------------------------------------------------------------ */
/* The call                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Fetch one order's detail from Shopee.
 *
 * REQUEST SHAPE — this is the part that returns an opaque error when you get it
 * wrong, so it is spelled out rather than left to the reader:
 *
 *   Method is GET, with NO request body at all. (Confirmed by
 *   passwind/go-shopee-v2, whose GetOrderDetailRequest tags both fields
 *   `url:"..."` and issues the call through the client's Get().) The token
 *   endpoints in shopee-auth.ts are POST-with-JSON-body; the Order API is not,
 *   and copying that pattern here is the classic way to break this call.
 *
 *   EVERYTHING goes in the QUERY STRING: the five auth params (partner_id,
 *   timestamp, access_token, shop_id, sign) plus order_sn_list,
 *   response_optional_fields and request_order_status_pending.
 *
 *   order_sn_list is comma-joined. The doc's own parameter description says:
 *   "The set of order_sn. If there are multiple order_sn, you need to use
 *   English comma to connect them. limit [1,50]". (One SDK instead repeats the
 *   key — ?k=a&k=b. The sources genuinely disagree here, but this function only
 *   ever asks about ONE ordersn, where both encodings are byte-identical, so
 *   the disagreement cannot bite us. Do NOT extend this to batch lookups
 *   without settling that first.)
 *
 *   The signature covers partner_id + api_path + timestamp + access_token +
 *   shop_id ONLY, never the query params — which is why signShopRequest() takes
 *   the path and nothing else.
 *
 * @param orderSn Shopee's `ordersn` — the same value the push webhook receives.
 * @param shopId  Optional. Omit it and the single authorized shop on file is
 *                used, matching getValidAccessToken()'s own default.
 *
 * @throws {ShopeeApiError} always — never a bare Error. See ShopeeApiErrorKind.
 */
export async function getOrderDetail(orderSn: string, shopId?: number): Promise<ShopeeOrderDetail> {
  if (typeof orderSn !== "string" || orderSn.trim() === "") {
    throw new ShopeeApiError("malformed", "getOrderDetail called with an empty orderSn", {
      orderSn: typeof orderSn === "string" ? orderSn : null,
    });
  }
  const sn = orderSn.trim();

  const partnerId = process.env.SHOPEE_PARTNER_ID;
  if (!partnerId) {
    throw new ShopeeApiError("auth", "SHOPEE_PARTNER_ID is not set", { orderSn: sn });
  }

  // Resolve the shop id BEFORE asking for a token when the caller did not pass
  // one: signShopRequest needs a concrete shop_id for the HMAC base string, and
  // getValidAccessToken hands back only the token string, so the stored row is
  // the only source for the id.
  let resolvedShopId = shopId;
  let accessToken: string;
  try {
    if (resolvedShopId === undefined) {
      const stored = await getStoredShopToken();
      if (!stored) {
        throw new Error(
          "No Shopee shop token on file — complete the authorization flow first (see /api/admin/shopee/auth-url).",
        );
      }
      resolvedShopId = stored.shopId;
    }
    // Called with the resolved id so that a refresh writes back to the right
    // row. This also transparently refreshes a token that is about to expire.
    accessToken = await getValidAccessToken(resolvedShopId);
  } catch (cause) {
    throw new ShopeeApiError(
      "auth",
      `Could not obtain a Shopee access token for order ${sn}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { orderSn: sn, cause },
    );
  }

  const { timestamp, sign } = await signShopRequest(
    GET_ORDER_DETAIL_PATH,
    accessToken,
    resolvedShopId,
  );

  const params = new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: String(resolvedShopId),
    sign,
    order_sn_list: sn,
    response_optional_fields: RESPONSE_OPTIONAL_FIELDS.join(","),
  });
  if (REQUEST_ORDER_STATUS_PENDING) {
    params.set("request_order_status_pending", "true");
  }

  const url = `${SHOPEE_API_HOST}${GET_ORDER_DETAIL_PATH}?${params.toString()}`;

  // AbortController rather than AbortSignal.timeout(): the latter is not in
  // this project's TS lib baseline (tsconfig "target": "ES2017") and would not
  // typecheck here.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  let bodyText: string;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      // Order state changes constantly and this drives a money decision.
      cache: "no-store",
    });
    bodyText = await res.text();
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === "AbortError";
    throw new ShopeeApiError(
      "network",
      aborted
        ? `Shopee get_order_detail timed out after ${REQUEST_TIMEOUT_MS}ms for order ${sn}`
        : `Shopee get_order_detail network failure for order ${sn}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
      { orderSn: sn, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  let envelope: ShopeeEnvelope;
  try {
    envelope = JSON.parse(bodyText) as ShopeeEnvelope;
  } catch (cause) {
    // Unparseable body. If the HTTP status was ALSO bad, "http" is the more
    // useful classification for a retry decision (a 502 from a proxy returns
    // an HTML error page); otherwise a 200 with non-JSON is malformed.
    throw new ShopeeApiError(
      res.ok ? "malformed" : "http",
      `Shopee get_order_detail returned non-JSON (HTTP ${res.status}) for order ${sn}: ${bodyText.slice(
        0,
        500,
      )}`,
      { orderSn: sn, httpStatus: res.status, cause },
    );
  }

  // Shopee reports failures with HTTP 200 and a non-empty top-level `error`.
  // This check comes BEFORE the res.ok check on purpose: when both are present,
  // Shopee's own error string ("error_auth", "error_param", ...) is far more
  // debuggable than "HTTP 500".
  if (typeof envelope.error === "string" && envelope.error.trim() !== "") {
    throw new ShopeeApiError(
      "shopee_error",
      `Shopee get_order_detail rejected order ${sn}: ${pickErrorText(envelope)}`,
      {
        orderSn: sn,
        shopeeError: envelope.error,
        shopeeMessage: envelope.message ?? null,
        requestId: envelope.request_id ?? null,
        httpStatus: res.status,
      },
    );
  }

  if (!res.ok) {
    throw new ShopeeApiError(
      "http",
      `Shopee get_order_detail returned HTTP ${res.status} for order ${sn} with no error payload: ${bodyText.slice(
        0,
        500,
      )}`,
      { orderSn: sn, httpStatus: res.status, requestId: envelope.request_id ?? null },
    );
  }

  const orderList = envelope.response?.order_list;
  if (!Array.isArray(orderList)) {
    throw new ShopeeApiError(
      "malformed",
      `Shopee get_order_detail succeeded for order ${sn} but response.order_list was missing or not an ` +
        "array. That means this module's assumption about the response envelope is wrong — do not paper " +
        "over it by treating the order as unknown.",
      { orderSn: sn, httpStatus: res.status, requestId: envelope.request_id ?? null },
    );
  }

  // Match on order_sn rather than taking [0]. We only ever ask for one, but
  // trusting position would silently deliver the wrong game if Shopee ever
  // returned a partial or reordered list.
  const raw = orderList.find(
    (o) => typeof o?.order_sn === "string" && o.order_sn.trim() === sn,
  );

  if (!raw) {
    throw new ShopeeApiError(
      "not_found",
      `Shopee get_order_detail returned no entry for order ${sn} (order_list had ${orderList.length} entr${
        orderList.length === 1 ? "y" : "ies"
      }). Either the ordersn is unknown to Shopee or it belongs to a different shop.`,
      { orderSn: sn, httpStatus: res.status, requestId: envelope.request_id ?? null },
    );
  }

  return normalizeOrder(sn, raw, envelope.request_id ?? null, res.status);
}

/**
 * Map Shopee's raw order object onto ShopeeOrderDetail, failing loudly on
 * anything that would leave the fulfillment pipeline guessing.
 */
function normalizeOrder(
  sn: string,
  raw: RawOrder,
  requestId: string | null,
  httpStatus: number,
): ShopeeOrderDetail {
  // order_status is an always-returned base field, not one of the optional
  // fields we request. If it is absent, our reading of the doc is wrong and
  // every downstream paid/unpaid decision would be built on nothing.
  if (typeof raw.order_status !== "string" || raw.order_status.trim() === "") {
    throw new ShopeeApiError(
      "malformed",
      `Shopee returned order ${sn} with no order_status. order_status is documented as an always-present ` +
        "base field; its absence means the request shape or the response mapping in lib/shopee-api.ts is wrong.",
      { orderSn: sn, requestId, httpStatus },
    );
  }

  // Three distinct buyer_username outcomes — absent, empty, masked — all
  // normalised to a null `buyerUsername`, so no caller can mistake a redaction
  // for a real name. `buyerUsernameMasked` is what tells them apart.
  const rawUsername = typeof raw.buyer_username === "string" ? raw.buyer_username : null;
  const trimmedUsername = rawUsername === null ? "" : rawUsername.trim();
  const masked = trimmedUsername !== "" && isMaskedValue(trimmedUsername);
  const usableUsername = trimmedUsername !== "" && !masked ? trimmedUsername : null;

  const payTime = toFiniteNumber(raw.pay_time);

  // item_list was explicitly requested, and a Shopee order cannot contain zero
  // items, so an absent or empty list is not "an order with nothing in it" — it
  // is a permissions problem or a wrong optional-field name. Fail loudly
  // (AGENTS.md rule 8) instead of handing fulfillment an empty array it would
  // quietly record as "no_mapping" and never look at again.
  if (!Array.isArray(raw.item_list) || raw.item_list.length === 0) {
    throw new ShopeeApiError(
      "malformed",
      `Shopee returned order ${sn} with no item_list even though "item_list" was requested in ` +
        "response_optional_fields. Do NOT treat this as an unmapped order — check the optional-field " +
        "names and the shop's API permissions first.",
      { orderSn: sn, requestId, httpStatus },
    );
  }

  const items: ShopeeOrderItem[] = raw.item_list.map((rawItem, index) => {
    const itemId = toFiniteNumber(rawItem?.item_id);
    if (itemId === null) {
      throw new ShopeeApiError(
        "malformed",
        `Shopee returned order ${sn} item[${index}] with no usable item_id; it cannot be mapped to a game.`,
        { orderSn: sn, requestId, httpStatus },
      );
    }
    // model_id is genuinely absent for listings without variations. 0 is the
    // agreed sentinel and matches shopee_listings.model_id's `not null default
    // 0`, so an unvaried listing is keyed (item_id, 0).
    const modelId = toFiniteNumber(rawItem?.model_id) ?? 0;
    const itemName = typeof rawItem?.item_name === "string" ? rawItem.item_name : "";
    return { itemId, modelId, itemName };
  });

  return {
    orderSn:
      typeof raw.order_sn === "string" && raw.order_sn.trim() !== "" ? raw.order_sn.trim() : sn,
    orderStatus: raw.order_status.trim(),
    buyerUsername: usableUsername,
    // Reuses the same numeric coercion as item_id/model_id so a string-typed
    // id is handled identically, and anything non-numeric becomes null rather
    // than NaN — a NaN to_id would be sent to Shopee as `null` and rejected
    // with "invalid_to_id", which is a confusing way to learn about a parsing
    // bug. toFiniteNumber() returns undefined for junk; normalise to null so
    // the field matches its declared `number | null` type.
    buyerUserId: toFiniteNumber(raw.buyer_user_id) ?? null,
    buyerUsernameMasked: masked,
    buyerUsernameRaw: rawUsername,
    payTime,
    items,
  };
}
