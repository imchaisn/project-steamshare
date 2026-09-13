/**
 * Chat response sweep — finds Shopee conversations where the buyer spoke last
 * and answers them, so a message arriving at 3am does not sit unanswered until
 * Chaison wakes up.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Shopee's Chat Response Rate (CRR) feeds shop standing and Preferred Seller
 * eligibility. One human cannot watch chat around the clock. The full reasoning,
 * the native Seller Centre levers, and the reply copy live in
 * docs/chat-response-playbook.md — READ IT BEFORE CHANGING THE TEMPLATES.
 *
 * ── THE HONEST CAVEAT, STATED UP FRONT ───────────────────────────────────
 * It is NOT established that a message sent through the Open Platform API
 * counts toward CRR. The evidence (research/2026-09-08-shopee-chat-response-rate.md)
 * says Shopee's OWN native Auto-Reply does not count — only a manual send does.
 * An API send carries no "this was automated" flag and is the same channel
 * seller CRM tools use, so it plausibly counts, but that is a HYPOTHESIS.
 *
 * This module is therefore built to be *measured*, not believed: it reports
 * exactly what it did, and Chaison reads CRR in Seller Centre before and after.
 * The escalation half (`stale` in the summary) works regardless of the answer —
 * a human reply inside the window always counts.
 *
 * ── WHY THERE IS NO DATABASE TABLE ───────────────────────────────────────
 * Dedupe is Shopee's own conversation state, not a table we maintain. When we
 * reply, WE become the last speaker, so the thread stops matching
 * buyerSpokeLast() and cannot be picked up again. That makes the sweep
 * naturally idempotent, needs no migration (the DB password is stale — see
 * CHECKPOINT — so every migration is a manual paste), and cannot drift out of
 * sync with reality the way a mirror table can.
 *
 * The one thing that state WOULD buy is loop prevention, and
 * alreadyAutoAssisted() buys it instead by reading the thread back: if our last
 * message was an auto-assist and the buyer has written again, the automation
 * steps aside and escalates to a human rather than talking past them twice.
 *
 * ── FAILURE POSTURE ──────────────────────────────────────────────────────
 * Nothing here is the money path. This module must never throw into its caller:
 * a Shopee outage means "nobody got an auto-reply this run", never a 500 that
 * makes a scheduler retry a send. Every per-conversation failure is contained
 * to that conversation and reported in the summary.
 */

/* ── Pure section ─────────────────────────────────────────────────────────
 * Everything above the impure divider is importable by bare `node --test`,
 * which cannot resolve the `@/` path alias. Same house rule as
 * lib/fulfillment.ts and lib/follow-up.ts: cross-module `@/` imports are
 * deferred to call time so the testable half stays loadable.
 *
 * lib/chat-ai.ts is a SIBLING (relative `./`, not `@/`), and its pure half
 * imports only a *type* from this file, so there is no runtime import cycle —
 * both load cleanly under `node --test --experimental-strip-types`. resolveAiMode
 * is re-exported so the route imports its whole surface from one module.
 */
import { RATING_ASK, resolveAiMode, type OrderFacts } from "./chat-ai.ts";
export { resolveAiMode };

/**
 * Stamped on every message this module sends, and the ONLY way it recognises
 * its own past replies when reading a thread back.
 *
 * Deliberately distinct from `[GameShare]` (used by the follow-up message) and
 * `[Auto Delivery]` (the delivery message). Reusing either would make a
 * follow-up look like an auto-assist, and a buyer replying to "please rate us"
 * would then be escalated instead of answered.
 *
 * It is visible to the buyer on purpose. They are talking to an automation and
 * saying so costs nothing; it also makes every message this module ever sent
 * findable in Seller Centre with one search.
 */
export const AUTO_ASSIST_MARKER = "[GameShare Assist]";

/** Which template a buyer's message earns. */
export type ReplyKind = "order_help" | "login_trouble" | "pre_purchase" | "holding";

/** The subset of Shopee's conversation object this module relies on. */
export interface ConversationSummary {
  conversation_id: string | number;
  to_id: string | number;
  to_name?: string;
  latest_message_from_id?: string | number;
  latest_message_content?: unknown;
  last_message_timestamp?: string | number;
  unread_count?: number;
}

/** The subset of Shopee's message object this module relies on. */
export interface ChatMessage {
  from_id?: string | number;
  message_type?: string;
  content?: unknown;
  created_timestamp?: string | number;
}

export interface Candidate {
  conversationId: string;
  buyerId: string;
  buyerName: string;
  text: string;
  ageHours: number;
  kind: ReplyKind;
}

/**
 * Shopee's chat timestamps are NANOSECONDS (~19 digits) — `FACT-V` 2026-09-08,
 * confirmed by differencing a known-recent conversation against wall clock.
 *
 * This is normalised by MAGNITUDE rather than by trusting the unit, because
 * getting it wrong is silent: read as milliseconds, every message lands ~50
 * million years in the past, every thread looks ancient, and the sweep either
 * escalates everything or replies to nothing. The first version of the probe
 * that found this made exactly that mistake.
 */
export function nanosToMillis(value: string | number | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1e17) return Math.floor(n / 1e6); // nanoseconds
  if (n > 1e14) return Math.floor(n / 1e3); // microseconds
  if (n > 1e11) return Math.floor(n); // milliseconds
  return Math.floor(n * 1000); // seconds
}

/**
 * Did the buyer send the most recent message?
 *
 * Compares the sender against `to_id` — the OTHER party — and deliberately
 * never references our own shop id.
 *
 * `FACT-V` 2026-09-08: the shop's chat user id is NOT `shop_id`; they are
 * different numbers. A version of this that tested `from_id !== shop_id`
 * marked 8 of 8 live conversations as awaiting a reply, including ones where
 * our own delivery bot had sent the last message. Built on that, this sweep
 * would have replied to itself on every single order.
 */
export function buyerSpokeLast(c: ConversationSummary): boolean {
  const from = c.latest_message_from_id;
  if (from === undefined || from === null) return false;
  return String(from) === String(c.to_id);
}

/**
 * Shopee wraps text as `{ text: "..." }`. Stickers, images and order cards have
 * no `text` at all, which is why this returns "" rather than throwing — a
 * buyer whose last message was a sticker still deserves a reply, they just get
 * the generic one.
 */
export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const t = (content as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

const LOGIN_WORDS = [
  "password", "cannot login", "can't login", "cant login", "log in", "login",
  "wrong pass", "invalid", "guard", "code not", "not working", "kicked",
  "kick out", "logged out", "error", "salah", "tak boleh", "tidak boleh",
  "masuk", "gagal",
];

const ORDER_WORDS = [
  "order id", "my code", "where", "how to", "how do", "tutorial", "guide",
  "received", "delivered", "delivery", "account", "username", "steam guard",
  "mana", "macam mana", "belum", "dapat", "hantar",
];

const PRE_PURCHASE_WORDS = [
  "available", "stock", "ready stock", "do you have", "got", "berapa", "harga",
  "price", "original", "legit", "genuine", "real", "online", "multiplayer",
  "co-op", "coop", "friend", "how does", "how it work", "ada", "boleh main",
  "murah", "asli",
];

function hits(haystack: string, needles: string[]): number {
  return needles.reduce((n, w) => (haystack.includes(w) ? n + 1 : n), 0);
}

/**
 * Route a buyer's message to a template.
 *
 * Ordering is deliberate and is a safety property, not a preference. A message
 * mentioning a login problem is answered as a login problem even if it also
 * says "how do I", because telling a stuck buyer to read the tutorial they have
 * already read is the reply most likely to make them angrier.
 *
 * Anything ambiguous falls through to "holding", which promises only that a
 * human is coming. A wrong confident answer is worse than an honest holding
 * reply — that is the whole reason there is a fallback rather than a
 * best-guess.
 */
export function classifyReply(text: string): ReplyKind {
  const t = text.toLowerCase().trim();
  if (t === "") return "holding";

  const login = hits(t, LOGIN_WORDS);
  const order = hits(t, ORDER_WORDS);
  const pre = hits(t, PRE_PURCHASE_WORDS);

  if (login > 0 && login >= pre) return "login_trouble";
  if (pre > 0 && pre >= order) return "pre_purchase";
  if (order > 0) return "order_help";
  return "holding";
}

const SITE = "https://www.gameshare.space";
const TUTORIAL = `${SITE}/tutorial`;

/**
 * The reply bodies. Kept in lockstep with docs/chat-response-playbook.md.
 *
 * Claim rules enforced (see .claude/skills/ss-market/SKILL.md §1): no online or
 * multiplayer capability claims — buyers play in Steam Offline Mode; no
 * "instant" — delivery is 24-hour; no lifetime or refund guarantee; nothing
 * offered in exchange for a review.
 *
 * A gameshare.space URL is fine HERE. The Shopee ban on external URLs applies
 * to listing descriptions and images, not to chat — the delivery message has
 * always carried these links.
 *
 * NOTE: no `/games` link. That URL currently 307-redirects to the ADMIN LOGIN
 * page (`FACT-V` 2026-09-08) because the page and its proxy.ts allowlist entry
 * are both uncommitted. Sending a buyer to a staff login form is worse than
 * sending them nowhere. Add it once that ships and the URL returns 200.
 */
export function buildReply(kind: ReplyKind): string {
  const head = AUTO_ASSIST_MARKER;

  if (kind === "order_help") {
    return [
      head,
      ``,
      `Your account details are already in this chat — please scroll up for the`,
      `[Auto Delivery] message.`,
      ``,
      `Password + Steam Guard code: ${SITE}`,
      `Enter your Shopee Order ID only (nothing else needed).`,
      ``,
      `Full guide: ${TUTORIAL}`,
      ``,
      `Butiran akaun anda ada dalam chat ini. Kod: ${SITE}`,
    ].join("\n");
  }

  if (kind === "login_trouble") {
    return [
      head,
      ``,
      `Sorry about that — two things fix almost every login issue:`,
      ``,
      `1) Use the password from ${SITE} (enter your Order ID).`,
      `   Copy it, don't retype it.`,
      `2) The Steam Guard code changes every 30 seconds. Take a fresh one and`,
      `   enter it straight away.`,
      ``,
      `Also check Step 4 (Steam Cloud OFF) and Step 6 (Go Offline):`,
      `${TUTORIAL}#step-7`,
      ``,
      `Still stuck? Reply with a screenshot and we'll sort it out personally.`,
    ].join("\n");
  }

  if (kind === "pre_purchase") {
    return [
      head,
      ``,
      `Thanks for your interest! These are real Steam accounts with the game`,
      `fully owned on them — you install through Steam as normal.`,
      ``,
      `• Single-player, in Steam Offline Mode`,
      `• Delivery is automatic, within 24 hours of payment, into this chat`,
      ``,
      `How it works: ${TUTORIAL}`,
      ``,
      `Tell us which game you're after and we'll confirm stock and price.`,
    ].join("\n");
  }

  return [
    head,
    ``,
    `Hi! Got your message — we're on it and will reply personally shortly.`,
    ``,
    `If it's about getting your code: ${SITE}`,
    `Enter your Shopee Order ID only.`,
    ``,
    `Terima kasih for your patience 🙏`,
  ].join("\n");
}

/**
 * Has this conversation already had an auto-assist that the buyer then talked
 * past?
 *
 * `messages` arrives NEWEST FIRST (`FACT-V` 2026-09-08). The walk skips the run
 * of unanswered buyer messages at the top, then inspects the first message of
 * OURS underneath it — the last thing we actually said.
 *
 * If that was an auto-assist, the automation has already had its turn and the
 * buyer came back anyway. Replying again would talk past a person who is
 * already not being helped, so this returns true and the caller escalates to a
 * human instead. If our last message was manual (or there is none), automation
 * is allowed.
 *
 * Returning `true` on unknown/empty input is deliberate: the safe direction is
 * to stay quiet and let a human handle it.
 */
export function alreadyAutoAssisted(messages: ChatMessage[], buyerId: string): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return true;

  for (const m of messages) {
    if (String(m.from_id ?? "") === String(buyerId)) continue; // buyer's burst
    return extractText(m.content).includes(AUTO_ASSIST_MARKER);
  }

  // Every message is the buyer's — they have written and we have never replied.
  return false;
}

/**
 * Assemble the final message body: the auto-assist marker (so the loop guard
 * and Seller Centre search can recognise our own work), the reply, and the
 * rating ask when it has been earned. Pure and tiny, but tested, because the
 * marker being present is a load-bearing property of the whole sweep.
 */
export function composeReply(body: string, askRating: boolean): string {
  const parts = [AUTO_ASSIST_MARKER, ``, body];
  if (askRating) parts.push(RATING_ASK);
  return parts.join("\n");
}

export interface SelectOptions {
  /**
   * Ignore anything newer than this. Gives Chaison a window to answer in person
   * first, and stops two overlapping sweeps racing onto the same fresh message.
   */
  minAgeMinutes: number;
  /**
   * Past this, an auto-reply is not the right move — the thread is already at
   * risk and wants a human. Reported as `stale` for escalation instead.
   */
  maxAgeHours: number;
  /**
   * Past THIS, ignore the thread entirely — neither reply nor escalate.
   *
   * Without an upper bound, "stale" is permanent: a thread that went unanswered
   * once is flagged ACTION REQUIRED on every run for the rest of time. The
   * first live dry run (2026-09-08) surfaced exactly this — three threads aged
   * 2,021h, 8,570h and 8,921h, respectively a year-old "Yes", another shop's
   * auto-reply, and a scam message. Escalating those every 15 minutes teaches
   * the operator to ignore the alert, which costs more than the alert is worth.
   *
   * The CRR window is long gone by then and nothing can be recovered, so the
   * honest handling is silence.
   */
  ignoreOlderThanHours: number;
}

/**
 * Pick the conversations worth replying to, newest first.
 *
 * Newest-first matters: the CRR clock on a fresh message still has hours left
 * and is savable, whereas one already past the window is spent. If a run hits
 * its send cap, it should have spent it on the threads it could still rescue.
 */
export function selectCandidates(
  conversations: ConversationSummary[],
  nowMs: number,
  opts: SelectOptions,
): { candidates: Candidate[]; stale: Candidate[] } {
  const candidates: Candidate[] = [];
  const stale: Candidate[] = [];

  for (const c of conversations) {
    if (!buyerSpokeLast(c)) continue;

    const ms = nanosToMillis(c.last_message_timestamp);
    if (ms === 0) continue;

    const ageHours = (nowMs - ms) / 3_600_000;
    if (ageHours < opts.minAgeMinutes / 60) continue;
    // Too old to rescue and too old to be worth an alert. See the field docs.
    if (ageHours > opts.ignoreOlderThanHours) continue;

    const text = extractText(c.latest_message_content);
    const entry: Candidate = {
      conversationId: String(c.conversation_id),
      buyerId: String(c.to_id),
      buyerName: String(c.to_name ?? "unknown"),
      text,
      ageHours,
      kind: classifyReply(text),
    };

    if (ageHours > opts.maxAgeHours) stale.push(entry);
    else candidates.push(entry);
  }

  candidates.sort((a, b) => a.ageHours - b.ageHours);
  stale.sort((a, b) => b.ageHours - a.ageHours);
  return { candidates, stale };
}

/* ── Impure section ──────────────────────────────────────────────────────── */

export interface SweepOptions extends SelectOptions {
  dryRun: boolean;
  /**
   * Hard cap on sends per run. Bounds the blast radius of a bad template or a
   * classifier mistake to N buyers rather than the whole inbox.
   */
  limit: number;
  /**
   * "off"     — the fixed templates (buildReply), the original behaviour;
   * "send"    — Claude writes the reply (lib/chat-ai.ts), validated, then sent;
   * "preview" — Claude writes the reply but nothing is sent (dryRun + ai=1).
   * Resolved by the route from this deployment's env; see resolveAiMode().
   */
  aiMode: "off" | "send" | "preview";
}

export interface SweepResult {
  conversationId: string;
  buyerName: string;
  kind: ReplyKind;
  ageHours: number;
  action: "sent" | "would_send" | "skipped_already_assisted" | "error";
  detail?: string;
  /** AI runs only: which lane produced the body, and the would-be reply on a dry/preview run. */
  lane?: "ai" | "acknowledge" | "fallback" | "template";
  preview?: string;
}

export interface SweepSummary {
  ok: boolean;
  dryRun: boolean;
  aiMode: "off" | "send" | "preview";
  scanned: number;
  awaitingReply: number;
  sent: number;
  results: SweepResult[];
  /** Threads past maxAgeHours — these want a HUMAN, and are the escalation list. */
  stale: Array<{ buyerName: string; ageHours: number; text: string }>;
  /**
   * Threads we ANSWERED but that still need a person: a refund/complaint that
   * got the fixed acknowledgement, an order problem, or a draft the validator
   * refused. Distinct from `stale` (never answered) — these had a reply sent,
   * the human owns the outcome.
   */
  escalations: Array<{ buyerName: string; reason: string }>;
  note?: string;
}

export const SWEEP_DEFAULTS: SweepOptions = {
  dryRun: false,
  limit: 10,
  minAgeMinutes: 5,
  maxAgeHours: 12,
  ignoreOlderThanHours: 72,
  aiMode: "off",
};

/** Shopee throttle. Mirrors the 250ms lib/shopee-chat.ts already self-imposes. */
const CALL_SPACING_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shopeeGet(
  path: string,
  params: Record<string, string>,
): Promise<{ error?: string; message?: string; response?: Record<string, unknown> }> {
  const { getValidAccessToken, getStoredShopToken, signShopRequest } = await import(
    "@/lib/shopee-auth"
  );
  const { SHOPEE_API_HOST } = await import("@/lib/shopee-api");

  const stored = await getStoredShopToken();
  if (!stored) throw new Error("no authorized Shopee shop on file");
  const shopId = stored.shopId;
  const accessToken = await getValidAccessToken(shopId);
  const { timestamp, sign } = await signShopRequest(path, accessToken, shopId);

  const q = new URLSearchParams({
    partner_id: String(process.env.SHOPEE_PARTNER_ID ?? ""),
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: String(shopId),
    sign,
    ...params,
  });

  // AbortController rather than AbortSignal.timeout(): the latter is outside
  // this project's ES2017 lib baseline and will not typecheck (same note as
  // lib/shopee-api.ts).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${SHOPEE_API_HOST}${path}?${q.toString()}`, {
      signal: controller.signal,
    });
    return (await res.json()) as { error?: string; response?: Record<string, unknown> };
  } finally {
    clearTimeout(timer);
  }
}

async function shopeeSend(toId: string, text: string): Promise<{ ok: boolean; detail: string }> {
  const { getValidAccessToken, getStoredShopToken, signShopRequest } = await import(
    "@/lib/shopee-auth"
  );
  const { SHOPEE_API_HOST } = await import("@/lib/shopee-api");

  const path = "/api/v2/sellerchat/send_message";
  const stored = await getStoredShopToken();
  if (!stored) return { ok: false, detail: "no authorized Shopee shop on file" };
  const shopId = stored.shopId;
  const accessToken = await getValidAccessToken(shopId);
  const { timestamp, sign } = await signShopRequest(path, accessToken, shopId);

  const q = new URLSearchParams({
    partner_id: String(process.env.SHOPEE_PARTNER_ID ?? ""),
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: String(shopId),
    sign,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${SHOPEE_API_HOST}${path}?${q.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Body shape confirmed live 2026-09-05: to_id, message_type "text", and
      // `content` NESTED as { text } — a flat string content is rejected.
      body: JSON.stringify({
        to_id: Number(toId),
        message_type: "text",
        content: { text },
      }),
      signal: controller.signal,
    });
    const json = (await res.json()) as { error?: string; message?: string };
    if (json.error) return { ok: false, detail: `${json.error} — ${json.message ?? ""}`.trim() };
    return { ok: true, detail: "sent" };
  } catch (e) {
    return { ok: false, detail: `send failed: ${String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up what we actually know about the buyer's orders, for the model's
 * context and the rating-ask gate. Best-effort: any DB trouble returns "no
 * facts", and the model still answers from the message alone. Reads only order
 * STATUS — never a credential, which is the whole point of not letting the
 * model near the accounts table.
 *
 * Game titles are deliberately omitted for now: joining orders -> order_games
 * -> account_games -> games depends on FK embeds this code cannot verify from
 * here (C10'), and a wrong join is worse than an absent title. Status alone
 * answers "is my order delivered", which is what the chat questions turn on.
 */
async function fetchOrderFacts(orderSns: string[]): Promise<OrderFacts[]> {
  if (orderSns.length === 0) return [];
  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("shopee_order_id, created_at, delivered_at, delivery_error")
      .in("shopee_order_id", orderSns);
    if (error || !data) return [];
    return data.map((o) => ({
      orderSn: String(o.shopee_order_id),
      games: [],
      createdAt: o.created_at ? String(o.created_at) : null,
      deliveredAt: o.delivered_at ? String(o.delivered_at) : null,
      deliveryFailed: Boolean(o.delivery_error) && !o.delivered_at,
    }));
  } catch {
    return [];
  }
}

/** Resolve a promise or a timeout, whichever comes first. A slow Claude call
 *  must not hold the 60s function open; on timeout the caller falls back to a
 *  template, exactly as it does for any other draft failure. */
async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One candidate that passed the loop guard and needs a reply built. */
interface Pending {
  candidate: Candidate;
  messages: ChatMessage[];
}

/**
 * One pass. Never throws — a thrown sweep would make the scheduler retry sends
 * whose whole contract is "at most once per buyer message".
 *
 * Three phases, so the 60s Hobby budget is respected:
 *   A. Read each thread SEQUENTIALLY (Shopee's 250ms throttle) and apply the
 *      loop guard.
 *   B. If AI is on, generate every draft CONCURRENTLY (each under its own
 *      timeout) — ten drafts cost ~one call's latency, not ten.
 *   C. Send SEQUENTIALLY (Shopee throttle again).
 */
export async function runChatSweep(overrides: Partial<SweepOptions> = {}): Promise<SweepSummary> {
  const opts = { ...SWEEP_DEFAULTS, ...overrides };
  const empty: SweepSummary = {
    ok: true,
    dryRun: opts.dryRun,
    aiMode: opts.aiMode,
    scanned: 0,
    awaitingReply: 0,
    sent: 0,
    results: [],
    stale: [],
    escalations: [],
  };

  let listed;
  try {
    listed = await shopeeGet("/api/v2/sellerchat/get_conversation_list", {
      direction: "latest",
      type: "all",
      page_size: "50",
    });
  } catch (e) {
    return { ...empty, ok: false, note: `could not list conversations: ${String(e)}` };
  }

  if (listed.error) {
    return { ...empty, ok: false, note: `get_conversation_list: ${listed.error}` };
  }

  const conversations = (listed.response?.conversations ?? []) as ConversationSummary[];
  const { candidates, stale } = selectCandidates(conversations, Date.now(), opts);

  const results: SweepResult[] = [];
  const escalations: Array<{ buyerName: string; reason: string }> = [];
  let sent = 0;

  const base = (c: Candidate): SweepResult => ({
    conversationId: c.conversationId,
    buyerName: c.buyerName,
    kind: c.kind,
    ageHours: Number(c.ageHours.toFixed(2)),
    action: "error",
  });

  // ── Phase A: read threads, apply the loop guard ─────────────────────────
  const pending: Pending[] = [];
  for (const c of candidates.slice(0, opts.limit)) {
    try {
      await sleep(CALL_SPACING_MS);
      const msgs = await shopeeGet("/api/v2/sellerchat/get_message", {
        conversation_id: c.conversationId,
      });
      if (msgs.error) throw new Error(msgs.error);
      const messages = (msgs.response?.messages ?? []) as ChatMessage[];
      if (alreadyAutoAssisted(messages, c.buyerId)) {
        results.push({
          ...base(c),
          action: "skipped_already_assisted",
          detail: "auto-assist already sent and the buyer wrote again — needs a human",
        });
        continue;
      }
      pending.push({ candidate: c, messages });
    } catch (e) {
      results.push({ ...base(c), action: "error", detail: `could not read thread, so did not reply: ${String(e)}` });
    }
  }

  // ── Phase B: build a body for each pending thread ───────────────────────
  interface Built {
    candidate: Candidate;
    body: string;
    lane: "ai" | "acknowledge" | "fallback" | "template";
    escalate: boolean;
    reason: string;
  }

  let built: Built[];
  if (opts.aiMode === "off") {
    built = pending.map((p) => ({
      candidate: p.candidate,
      body: buildReply(p.candidate.kind),
      lane: "template" as const,
      escalate: false,
      reason: "",
    }));
  } else {
    const chatAi = await import("./chat-ai.ts");
    let client: Awaited<ReturnType<typeof chatAi.makeAnthropicClient>> | null = null;
    let clientErr: unknown = null;
    try {
      client = await chatAi.makeAnthropicClient();
    } catch (e) {
      clientErr = e;
    }

    if (client === null) {
      // No client (missing key/SDK) — degrade the WHOLE run to templates rather
      // than fail. Should not happen: the route only asks for AI when the key
      // is present, but this keeps a misconfiguration inert rather than broken.
      // These still flow through Phase C and get sent, exactly like `off` mode.
      // buildReply already carries the marker; do NOT run it through composeReply.
      built = pending.map((p) => ({
        candidate: p.candidate,
        body: buildReply(p.candidate.kind),
        lane: "template" as const,
        escalate: false,
        reason: `AI unavailable (${String(clientErr)}), used template`,
      }));
    } else {
      const activeClient = client;
      built = await Promise.all(
      pending.map(async (p): Promise<Built> => {
        const sns = chatAi.extractOrderSns(p.messages, p.candidate.buyerId);
        const facts = await fetchOrderFacts(sns);
        const gen = await withTimeout(
          chatAi.generateDraft(
            { messages: p.messages, buyerId: p.candidate.buyerId, facts },
            { client: activeClient },
          ),
          chatAi.CALL_TIMEOUT_MS,
          { draft: null, detail: "timed out" },
        );
        const decision = chatAi.decideReply({
          draft: gen.draft,
          facts,
          ratingAlreadyAsked: chatAi.ratingAlreadyAsked(p.messages, p.candidate.buyerId),
          fallbackBody: buildReply(p.candidate.kind),
        });
        // The fallback body is a template, which already carries the marker;
        // the ai/acknowledge bodies are marker-less, so composeReply stamps it
        // (and appends the rating ask, only ever set on the ai lane).
        const body =
          decision.lane === "fallback"
            ? decision.body
            : composeReply(decision.body, decision.askRating);
        return {
          candidate: p.candidate,
          body,
          lane: decision.lane,
          escalate: decision.escalate,
          reason: decision.reason || gen.detail,
        };
      }),
      );
    }
  }

  // ── Phase C: send (or, on dry/preview, report the would-be body) ────────
  const previewing = opts.dryRun || opts.aiMode === "preview";
  for (const b of built) {
    if (b.escalate) {
      escalations.push({ buyerName: b.candidate.buyerName, reason: b.reason });
    }
    if (previewing) {
      results.push({
        ...base(b.candidate),
        action: "would_send",
        lane: b.lane,
        preview: b.body,
        detail: b.reason || undefined,
      });
      continue;
    }
    await sleep(CALL_SPACING_MS);
    const outcome = await shopeeSend(b.candidate.buyerId, b.body);
    if (outcome.ok) sent += 1;
    results.push({
      ...base(b.candidate),
      action: outcome.ok ? "sent" : "error",
      lane: b.lane,
      detail: outcome.ok ? b.reason || undefined : outcome.detail,
    });
  }

  return finish();

  function finish(): SweepSummary {
    return {
      ok: true,
      dryRun: opts.dryRun,
      aiMode: opts.aiMode,
      scanned: conversations.length,
      awaitingReply: candidates.length + stale.length,
      sent,
      results,
      stale: stale.map((s) => ({
        buyerName: s.buyerName,
        ageHours: Number(s.ageHours.toFixed(2)),
        text: s.text.slice(0, 120),
      })),
      escalations,
    };
  }
}
