/**
 * chat-ai.ts — Claude writes the reply the chat sweep sends.
 *
 * lib/chat-sweep.ts finds the conversations and does the sending; this module
 * replaces the four fixed templates (buildReply) with an answer written for the
 * buyer's actual message, and appends the 5-star rating ask when — and only
 * when — asking is fair. When this module cannot produce a safe reply, the
 * sweep falls back to the very template it always used, so the worst case is
 * exactly the old behaviour.
 *
 * ── THE SAFETY MODEL, STATED FIRST BECAUSE IT IS THE POINT ───────────────
 * A model writing unsupervised into a live shop's chat is the risk. Four
 * structural guards contain it — none of them is "we prompted it nicely":
 *
 *   1. CREDENTIALS NEVER ENTER THE PROMPT. Every delivered buyer's thread
 *      contains the [Auto Delivery] message with a live Steam password.
 *      redactForModel() strips it before the thread is rendered, so a password
 *      is not in context and therefore cannot be echoed out. Tested against the
 *      real message shape.
 *   2. THE MODEL RETURNS JSON, NOT PROSE. A json_schema output config yields
 *      {topic, reply, needs_human, confidence}. needs_human or low confidence
 *      routes to a human instead of sending.
 *   3. A DETERMINISTIC VALIDATOR runs on the text before it is sent —
 *      validateReply(), plain code, no model. It blocks credential-shaped
 *      strings, the claim-rule words (refund/guarantee/lifetime/instant/
 *      multiplayer/…), off-platform links, and over-length. A failure falls
 *      back to a template and escalates. This is the last thing between the
 *      model and a buyer.
 *   4. REFUNDS AND COMPLAINTS GET NO GENERATED TEXT. That lane always sends a
 *      fixed acknowledgement and escalates — a sentence like "we'll refund you"
 *      is evidence in a Shopee dispute, so the model is never allowed to write
 *      one. Chaison asked for the bot to cover refunds; this is how it covers
 *      them without committing the shop to anything.
 *
 * ── CLAIM RULES (.claude/skills/ss-market/SKILL.md §1) ───────────────────
 * No online/multiplayer capability (buyers play in Steam Offline Mode), no
 * "instant" (24-hour), no lifetime or refund guarantee, and — because this
 * message can carry a rating ask — nothing offered in exchange for a review
 * (docs/promotions-and-bundles.md §6a). The validator enforces the words; the
 * system prompt explains the why so the model does not fight the validator.
 *
 * ── COVERAGE BOUNDARY (matches lib/chat-sweep.ts, lib/follow-up.ts) ───────
 * Everything above the impure divider is pure and importable by bare
 * `node --test`, which cannot resolve the `@/` alias. generateDraft() takes its
 * Anthropic client as a parameter so tests hand it a fake — no network, no key,
 * no spend. The `@anthropic-ai/sdk` import is deferred to call time for the same
 * reason lib/chat-sweep.ts defers its Supabase imports.
 */

import type { ChatMessage } from "./chat-sweep.ts";

/* ── Pure section ─────────────────────────────────────────────────────────*/

export const CHAT_AI_MODEL = "claude-opus-5";

/** Distinct from lib/chat-sweep's AUTO_ASSIST_MARKER only by intent; the sweep
 *  stamps the marker onto whatever body this module produces, so nothing here
 *  needs to. */

/**
 * The topics the model may assign. This list is also the routing table:
 * shouldAskForRating() and decideReply() switch on it, so adding a value here
 * without teaching those two what to do with it is a mistake the AI_TOPICS/enum
 * test is meant to make visible.
 */
export const AI_TOPICS = [
  "how_to", // where's my code, how do I redeem, tutorial steps
  "login_trouble", // wrong password, kicked out, Guard code, won't launch
  "pre_purchase", // is it legit, do you have X, can I play with a friend
  "order_problem", // late/not delivered, "not what I ordered" — money at stake
  "refund_complaint", // refund, return, chargeback, threat to report — no generated text
  "other", // greeting, thanks, anything that fits nothing above
] as const;
export type AiTopic = (typeof AI_TOPICS)[number];

export type AiConfidence = "high" | "medium" | "low";

export interface AiDraft {
  topic: AiTopic;
  reply: string;
  needs_human: boolean;
  confidence: AiConfidence;
}

/**
 * The JSON schema the model must satisfy (strict). Exported so the test can
 * assert additionalProperties:false, the full required set, and that the topic
 * enum stays in lockstep with AI_TOPICS — the coupling that keeps the routing
 * table honest.
 */
export const AI_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "reply", "needs_human", "confidence"],
  properties: {
    topic: { type: "string", enum: [...AI_TOPICS] },
    reply: {
      type: "string",
      description:
        "The reply to send the buyer, in the buyer's language (English or Malay). " +
        "Plain text, under 600 characters, no credentials, no links except " +
        "gameshare.space or shopee.com.my. Do NOT include the rating request — " +
        "that is appended separately when appropriate.",
    },
    needs_human: {
      type: "boolean",
      description:
        "true if this genuinely needs the shop owner — you are unsure, the buyer " +
        "is angry, or answering could commit the shop to money or a promise.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

/** Facts about one of the buyer's orders, read from our DB — never from what
 *  the buyer typed. Assembled by the impure layer, consumed by the pure one. */
export interface OrderFacts {
  orderSn: string;
  games: string[];
  createdAt: string | null;
  deliveredAt: string | null;
  /** delivery_error is set and delivered_at is null: the pipeline tried and failed. */
  deliveryFailed: boolean;
}

const SITE = "https://www.gameshare.space";
const TUTORIAL = `${SITE}/tutorial`;

/**
 * The rating ask, appended after a genuinely helpful reply to a delivered
 * buyer. Fixed text, never model-written — it sits one validator away from the
 * incentivised-review line, so it must be identical every time and auditable.
 *
 * Mirrors buildReceiptNudgeMessage() in lib/fulfillment.ts: the "Once the game
 * is working" condition is load-bearing (pressing Order Received releases
 * escrow — never invite that before the login is proven), and there is NOTHING
 * offered in exchange for the stars.
 */
export const RATING_ASK = [
  ``,
  `— — —`,
  `Once the game is working, a ⭐⭐⭐⭐⭐ 5-star rating would mean a lot — we're a`,
  `new shop and it genuinely helps. Terima kasih! 🙏`,
].join("\n");

/**
 * The fixed reply for the refund/complaint lane. No promise, no number, no
 * outcome — it buys the response-window clock and routes the buyer to a human,
 * which is the whole job. Passes validateReply(), asserted.
 */
export const COMPLAINT_ACK = [
  `Thanks for your message — I'm sorry for the trouble.`,
  ``,
  `I've flagged this to the shop owner to look into personally, and you'll get`,
  `a reply here shortly. Terima kasih for your patience 🙏`,
].join("\n");

export const SYSTEM_PROMPT = [
  `You are the customer-service assistant for GameShare, a Shopee Malaysia shop`,
  `that sells shared Steam-account access to PC games. You are replying inside`,
  `Shopee Chat. Buyers write in English or Malay; reply in the language they used.`,
  ``,
  `HOW THE PRODUCT WORKS (the truth — never contradict it):`,
  `- The buyer orders on Shopee. Within 24 hours the Steam account details are`,
  `  sent automatically into the Shopee chat.`,
  `- To get their password and a live Steam Guard code they enter their Shopee`,
  `  Order ID (nothing else) at ${SITE}. Full guide: ${TUTORIAL}.`,
  `- Games are played in Steam OFFLINE MODE, single-player.`,
  `- Every session: Step 4 (Steam Cloud OFF) and Step 6 (Go Offline). Skipping`,
  `  these causes most "kicked out" and "won't launch" problems.`,
  ``,
  `HARD RULES — these are promises the product cannot keep or Shopee policy;`,
  `breaking one gets the reply thrown away by an automatic check, so do not:`,
  `- Claim online play, multiplayer, or co-op of any kind. It is offline`,
  `  single-player only. If a buyer asks to play with a friend, say plainly that`,
  `  it is not possible on these accounts.`,
  `- Say "instant" — delivery is within 24 hours.`,
  `- Promise a refund, a return, a replacement, a lifetime or any guarantee.`,
  `- Offer a voucher, discount, coin, gift or anything else in return for a review.`,
  `- Write out any password or Steam Guard code, or tell the buyer to send you one.`,
  `- Link anywhere except ${SITE} or the shop's own shopee.com.my pages. No`,
  `  WhatsApp, Telegram, or other contact channel.`,
  ``,
  `WHEN TO HAND OFF (set needs_human=true and keep the reply short and neutral):`,
  `- Any refund, return, chargeback, or threat to report the shop.`,
  `- The buyer is angry, or an honest answer would commit the shop to money or a`,
  `  promise.`,
  `- You are not sure. A holding reply plus a human beats a confident wrong answer.`,
  ``,
  `Be warm, brief, and concrete. Use the order facts you are given; do not invent`,
  `order status, prices, or stock. Reply ONLY with the JSON the schema defines —`,
  `do not include the rating request, it is added separately.`,
].join("\n");

/**
 * Remove anything credential-shaped from a single message before it is shown to
 * the model. Deliberately over-broad: a false positive costs the model a little
 * context, a false negative puts a shared account's password into a third-party
 * prompt. Order IDs (alphanumeric, typically starting with digits then letters)
 * are preserved because they carry no risk and are what make an answer useful.
 */
export function redactForModel(text: string): string {
  if (typeof text !== "string" || text === "") return "";
  const REDACTED = "[redacted]";
  return (
    text
      // Labelled secrets: "Password: x", "Username: x", Malay "Kata laluan: x",
      // loose "pass: x". Everything to end of line goes.
      .replace(/\b(pass(?:word)?|user(?:name)?|kata\s*laluan|nama\s*pengguna)\b\s*[:=]?\s*\S.*$/gim, `$1: ${REDACTED}`)
      // "your password is X" / "the password X" phrasings the label rule misses.
      .replace(/\bpassword\s+(?:is\s+)?\S+/gi, `password ${REDACTED}`)
      // A bare run of 6+ digits — the Wukong backup sheet's numeric passwords —
      // UNLESS it is inside a longer alphanumeric token (an Order ID like
      // 2609069FEQGS05 has letters, so \b...\b around pure digits won't match it).
      .replace(/(?<![0-9A-Za-z])\d{6,}(?![0-9A-Za-z])/g, REDACTED)
  );
}

const ORDER_SN_RE = /Order ID:\s*([A-Z0-9]{6,})/gi;

/**
 * The Shopee order ids this conversation legitimately references. Only two
 * sources are trusted, because only two cannot be forged by a buyer typing:
 *   - a message WE sent ([Auto Delivery] / [GameShare]), which carries the id
 *     of an order we actually fulfilled into this thread; and
 *   - a Shopee "order" card (message_type "order"), whose order_sn Shopee fills
 *     in, not the sender.
 * An "Order ID: …" a BUYER types is ignored: automated orders store no buyer
 * chat id (lib/fulfillment.ts), so the thread is the only link between a
 * conversation and an order, and trusting typed ids would let anyone pull any
 * order's status by guessing an id. Deduped, first-seen order preserved.
 */
export function extractOrderSns(messages: ChatMessage[], buyerId: string): string[] {
  if (!Array.isArray(messages)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (sn: unknown) => {
    if (typeof sn !== "string") return;
    const v = sn.trim().toUpperCase();
    if (v.length >= 6 && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };

  for (const m of messages) {
    const fromBuyer = String(m.from_id ?? "") === String(buyerId);
    if (m.message_type === "order") {
      // Shopee-generated card. Trusted regardless of sender.
      const c = m.content as { order_sn?: unknown } | null | undefined;
      add(c?.order_sn);
      continue;
    }
    if (fromBuyer) continue; // buyer's own text is never trusted for an id
    // One of our text messages: pull "Order ID: X" out of it.
    const text = typeof m.content === "string"
      ? m.content
      : ((m.content as { text?: unknown } | null)?.text ?? "");
    if (typeof text !== "string") continue;
    for (const match of text.matchAll(ORDER_SN_RE)) add(match[1]);
  }
  return out;
}

/**
 * Render the thread for the model: oldest first (Shopee returns newest first),
 * each message tagged by speaker, every message run through redactForModel, and
 * the whole thing fenced. The buyer's own text has its fence-closing token
 * neutralised so it cannot break out and pose as the operator — the standard
 * prompt-injection seam for a chat bot.
 */
export function renderConversation(
  messages: ChatMessage[],
  buyerId: string,
  facts: OrderFacts[],
): string {
  const lines: string[] = [];

  if (facts.length > 0) {
    lines.push("<orders>");
    for (const f of facts) {
      const status = f.deliveryFailed
        ? "delivery FAILED — not delivered"
        : f.deliveredAt
          ? `delivered ${f.deliveredAt}`
          : "not delivered yet";
      lines.push(`- Order ${f.orderSn}: ${f.games.join(", ") || "unknown game"} — ${status}`);
    }
    lines.push("</orders>");
  }

  const ordered = [...messages].reverse(); // oldest first
  lines.push("<conversation>");
  for (const m of ordered) {
    const who = String(m.from_id ?? "") === String(buyerId) ? "BUYER" : "SHOP";
    if (m.message_type === "order") {
      lines.push(`${who}: [Shopee order card]`);
      continue;
    }
    const raw = typeof m.content === "string"
      ? m.content
      : ((m.content as { text?: unknown } | null)?.text ?? "");
    const safe = redactForModel(String(raw ?? ""))
      // Stop buyer text from closing the fence and issuing operator instructions.
      .replace(/<\/?conversation>/gi, "[tag]");
    lines.push(`${who}: ${safe}`);
  }
  lines.push("</conversation>");
  return lines.join("\n");
}

/** Parse and fully validate the model's JSON. Anything off-schema returns null
 *  — a half-trusted object is more dangerous than none, because the caller
 *  would treat it as a real draft. */
export function parseDraft(raw: string): AiDraft | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 4) return null; // no extras, no missing
  if (!AI_TOPICS.includes(o.topic as AiTopic)) return null;
  if (typeof o.reply !== "string") return null;
  if (typeof o.needs_human !== "boolean") return null;
  if (!["high", "medium", "low"].includes(o.confidence as string)) return null;
  return {
    topic: o.topic as AiTopic,
    reply: o.reply,
    needs_human: o.needs_human,
    confidence: o.confidence as AiConfidence,
  };
}

const MAX_REPLY_LEN = 800;

/**
 * Words that must never appear in a sent reply. The claim rules (§1) plus the
 * incentive words that must not sit near a rating ask (§6a). Matched as
 * substrings, case-insensitively — deliberately blunt: "no refund" is blocked
 * too, because the safe move on any of these is to let a human phrase it.
 */
const FORBIDDEN_WORDS = [
  "instant",
  "lifetime",
  "life time",
  "guarantee",
  "refund",
  "play online",
  "online play",
  "online multiplayer",
  "multiplayer",
  "co-op",
  "coop",
  "voucher",
  "discount",
  "cashback",
];

/** Hosts a reply may link to. Anything else — WhatsApp, Telegram, link
 *  shorteners, another shop — is an attempt to move the buyer off-platform. */
const ALLOWED_LINK_HOSTS = ["gameshare.space", "shopee.com.my"];

const OFF_PLATFORM_WORDS = ["whatsapp", "wa.me", "telegram", "t.me", " wechat"];

/**
 * The last check before a reply reaches a buyer. Pure, deterministic, no model.
 * Returns {ok:true} or {ok:false, reason} — the reason is logged and, in dryRun,
 * surfaced, so a persistently-refused pattern is visible rather than silent.
 */
export function validateReply(reply: string): { ok: true } | { ok: false; reason: string } {
  if (typeof reply !== "string") return { ok: false, reason: "reply is not a string" };
  const trimmed = reply.trim();
  if (trimmed === "") return { ok: false, reason: "empty reply" };
  if (reply.length > MAX_REPLY_LEN) return { ok: false, reason: `over ${MAX_REPLY_LEN} chars` };

  const lower = reply.toLowerCase();

  for (const w of FORBIDDEN_WORDS) {
    if (lower.includes(w)) return { ok: false, reason: `forbidden claim word: "${w}"` };
  }

  // Every URL must be on an allowed host, and none may point at /games (which
  // 307-redirects to the admin login — FACT-V 2026-09-08). Checked BEFORE the
  // digit-run heuristic below, because a Shopee product URL legitimately
  // carries long numeric ids (shop id, item id) that would otherwise read as a
  // credential.
  for (const match of reply.matchAll(/https?:\/\/([^/\s]+)(\/\S*)?/gi)) {
    const host = match[1].toLowerCase();
    const path = (match[2] ?? "").toLowerCase();
    if (!ALLOWED_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { ok: false, reason: `link to a disallowed host: ${host}` };
    }
    if (path.startsWith("/games")) {
      return { ok: false, reason: "links to /games (redirects to admin login)" };
    }
  }

  // Credential-shaped text. The label check requires an explicit ":" or "="
  // separator, so "get your password and code" (a normal instruction) passes
  // while "Password: hunter2" does not. The bare-digit-run check is applied to
  // the reply with URLs removed, so a Shopee product link's numeric ids do not
  // read as a numeric account password.
  if (/\b(pass(?:word)?|kata\s*laluan)\b\s*[:=]\s*\S/i.test(reply)) {
    return { ok: false, reason: "looks like it carries a credential" };
  }
  const withoutUrls = reply.replace(/https?:\/\/\S+/gi, " ");
  if (/(?<![0-9A-Za-z])\d{6,}(?![0-9A-Za-z])/.test(withoutUrls)) {
    return { ok: false, reason: "contains a long digit run (possible credential)" };
  }

  for (const w of OFF_PLATFORM_WORDS) {
    if (lower.includes(w)) return { ok: false, reason: `off-platform contact: "${w.trim()}"` };
  }

  return { ok: true };
}

/** Was a rating already asked in this thread — by us? Recognises the star run
 *  in a SHOP message only; a buyer typing ⭐ back does not count, or a happy
 *  buyer would suppress the very ask they earned. */
export function ratingAlreadyAsked(messages: ChatMessage[], buyerId: string): boolean {
  if (!Array.isArray(messages)) return false;
  for (const m of messages) {
    if (String(m.from_id ?? "") === String(buyerId)) continue;
    const text = typeof m.content === "string"
      ? m.content
      : ((m.content as { text?: unknown } | null)?.text ?? "");
    if (typeof text === "string" && text.includes("⭐⭐⭐⭐⭐")) return true;
  }
  return false;
}

/**
 * Should the rating ask be appended? Only when ALL hold:
 *   - the topic is a satisfied one (how_to / other) — never a stuck, unhappy,
 *     or pre-purchase buyer;
 *   - the buyer has at least one order that actually delivered — asking someone
 *     to rate before they have anything is both pointless and against the
 *     "once it's working" principle; and
 *   - we have not already asked in this thread.
 */
export function shouldAskForRating(
  topic: AiTopic,
  facts: OrderFacts[],
  alreadyAsked: boolean,
): boolean {
  if (alreadyAsked) return false;
  if (topic !== "how_to" && topic !== "other") return false;
  return facts.some((f) => !f.deliveryFailed && f.deliveredAt);
}

export type ReplyLane = "ai" | "acknowledge" | "fallback";

export interface ReplyDecision {
  lane: ReplyLane;
  /** The body to send (before the sweep stamps its marker on it). */
  body: string;
  /** Append the rating ask to `body` before sending. */
  askRating: boolean;
  /** This thread still needs a person, even though we replied. */
  escalate: boolean;
  /** Why we fell back / escalated — for logs and the dryRun summary. */
  reason: string;
}

export interface DecideInput {
  draft: AiDraft | null;
  facts: OrderFacts[];
  ratingAlreadyAsked: boolean;
  /** The template the sweep would have sent — used verbatim on any fallback. */
  fallbackBody: string;
}

/**
 * Turn a draft (or its absence) into a decision. This is the routing table the
 * whole feature turns on, and it is pure so every branch is tested.
 *
 * - No draft / needs_human / low confidence / validation failure -> FALLBACK:
 *   send the old template, escalate to a human. Never worse than today.
 * - refund_complaint -> ACKNOWLEDGE: fixed text, escalate, never generated.
 * - order_problem    -> AI answer + escalate (money is at stake), no rating ask.
 * - everything else  -> AI answer; rating ask iff shouldAskForRating().
 */
export function decideReply(input: DecideInput): ReplyDecision {
  const { draft, facts, fallbackBody } = input;

  if (!draft) {
    return { lane: "fallback", body: fallbackBody, askRating: false, escalate: true, reason: "no draft produced" };
  }
  if (draft.needs_human) {
    return { lane: "fallback", body: fallbackBody, askRating: false, escalate: true, reason: "model set needs_human" };
  }
  if (draft.confidence === "low") {
    return { lane: "fallback", body: fallbackBody, askRating: false, escalate: true, reason: "low confidence" };
  }

  if (draft.topic === "refund_complaint") {
    // Never generated text here — see the module header. The fixed ack is
    // validated at module-load-time by the test, so it cannot silently rot.
    return { lane: "acknowledge", body: COMPLAINT_ACK, askRating: false, escalate: true, reason: "refund/complaint — needs a person" };
  }

  const check = validateReply(draft.reply);
  if (!check.ok) {
    return { lane: "fallback", body: fallbackBody, askRating: false, escalate: true, reason: `validator: ${check.reason}` };
  }

  if (draft.topic === "order_problem") {
    // The model may state facts (delivered when, details are above) but a person
    // still owns the outcome, and a rating ask on an unresolved problem is tone-deaf.
    return { lane: "ai", body: draft.reply, askRating: false, escalate: true, reason: "order problem — answered, needs a person to close" };
  }

  const askRating = shouldAskForRating(draft.topic, facts, input.ratingAlreadyAsked);
  return { lane: "ai", body: draft.reply, askRating, escalate: false, reason: "" };
}

/**
 * Decide what THIS run does about AI, from this deployment's env and the query.
 * Kept pure and separate so the route never scatters process.env checks and so
 * the "a query param can only preview, never send live" rule is testable.
 *
 *   - "send"    : write AI replies and send them (key present, flag true, live run)
 *   - "preview" : write AI drafts but send nothing (dryRun + ai=1, key present)
 *   - "off"     : use the fixed templates (no key, flag not set, or plain live run)
 */
export function resolveAiMode(opts: {
  hasKey: boolean;
  envFlag: string | undefined;
  dryRun: boolean;
  aiParam: boolean;
}): "send" | "preview" | "off" {
  if (!opts.hasKey) return "off";
  if (opts.dryRun) return opts.aiParam ? "preview" : "off";
  return opts.envFlag === "true" ? "send" : "off";
}

/* ── Impure section ───────────────────────────────────────────────────────*/

export interface GenerateInput {
  messages: ChatMessage[];
  buyerId: string;
  facts: OrderFacts[];
}

export interface GenerateResult {
  draft: AiDraft | null;
  /** Detail for logs/dryRun when draft is null (refusal, parse miss, API error). */
  detail: string;
}

/**
 * The one call to Claude. Returns a validated draft or null — it NEVER throws,
 * because it runs inside the sweep's per-conversation loop and a throw there
 * would abort the whole run (and, worse, tempt a scheduler retry of sends).
 *
 * The client is injected. Production passes a real Anthropic client; tests pass
 * a fake. The type is intentionally structural and loose (`AnthropicLike`) so
 * this file needs no value import of the SDK to be testable by bare node.
 */
interface AnthropicLike {
  beta: {
    messages: {
      create: (params: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

/** Per-call ceiling. Ten of these run concurrently inside a 60s function, so no
 *  single slow call can hold the sweep open to the platform timeout. */
const CALL_TIMEOUT_MS = 20_000;

export async function generateDraft(
  input: GenerateInput,
  deps: { client: AnthropicLike },
): Promise<GenerateResult> {
  const conversation = renderConversation(input.messages, input.buyerId, input.facts);

  let response: unknown;
  try {
    response = await deps.client.beta.messages.create({
      model: CHAT_AI_MODEL,
      max_tokens: 1024,
      // Opus 5 safety classifiers can decline; route the decline to Anthropic's
      // recommended fallback by category rather than returning a refusal here.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        // low effort: this is short, high-volume chat, exactly the workload the
        // cost guide says does not repay higher effort.
        effort: "low",
        format: { type: "json_schema", schema: AI_DRAFT_SCHEMA },
      },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: conversation }],
    } as Record<string, unknown>);
  } catch (e) {
    return { draft: null, detail: `api error: ${String(e instanceof Error ? e.message : e)}` };
  }

  const r = response as {
    stop_reason?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (r.stop_reason === "refusal") {
    return { draft: null, detail: "model returned a refusal" };
  }
  const text = (r.content ?? []).find((b) => b.type === "text")?.text ?? "";
  const draft = parseDraft(text);
  return draft ? { draft, detail: "ok" } : { draft: null, detail: "model output did not match schema" };
}

/** The client factory, kept here so callers do not import the SDK themselves.
 *  Deferred import: the pure half of this file must load under bare node. */
export async function makeAnthropicClient(): Promise<AnthropicLike> {
  const mod = await import("@anthropic-ai/sdk");
  const Anthropic = mod.default;
  return new Anthropic() as unknown as AnthropicLike;
}

/** The per-call timeout, exported so the sweep can wrap each concurrent call. */
export { CALL_TIMEOUT_MS };
