import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_ASSIST_MARKER,
  alreadyAutoAssisted,
  buildReply,
  buyerSpokeLast,
  classifyReply,
  composeReply,
  extractText,
  nanosToMillis,
  resolveAiMode,
  selectCandidates,
  type ChatMessage,
  type ConversationSummary,
} from "./chat-sweep.ts";
import { RATING_ASK } from "./chat-ai.ts";

// Same coverage boundary as lib/follow-up.test.ts: the pure half — the part
// that decides WHO gets messaged and WHAT they read — is tested here.
// runChatSweep() talks to Shopee on every path and this repo has no test
// double for it, so it is documented rather than faked.

const BUYER = "460819991";
const SHOP_CHAT_ID = "1598824452";

function conv(over: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    conversation_id: "111",
    to_id: BUYER,
    to_name: "buyer",
    latest_message_from_id: BUYER,
    latest_message_content: { text: "hello" },
    last_message_timestamp: "1788855905137724700",
    ...over,
  };
}

// ── The two conventions that silently break a responder ──────────────────

test("buyerSpokeLast compares against to_id, NOT our shop id", () => {
  assert.equal(buyerSpokeLast(conv({ latest_message_from_id: BUYER })), true);
  assert.equal(buyerSpokeLast(conv({ latest_message_from_id: SHOP_CHAT_ID })), false);
});

test("REGRESSION: our own delivery message must never look like a buyer message", () => {
  // The shop's chat user id is NOT shop_id. A version testing `from_id !== shop_id`
  // marked 8 of 8 live conversations as awaiting a reply — including ones our own
  // delivery bot had just spoken in — and would have replied to itself every order.
  const ourDelivery = conv({
    latest_message_from_id: SHOP_CHAT_ID,
    latest_message_content: { text: "[Auto Delivery]\nBatman Arkham Knight\nOrder ID: X" },
  });
  assert.equal(buyerSpokeLast(ourDelivery), false);
  const { candidates, stale } = selectCandidates([ourDelivery], Date.now(), {
    minAgeMinutes: 5,
    maxAgeHours: 12,
    ignoreOlderThanHours: 72,
  });
  assert.equal(candidates.length, 0);
  assert.equal(stale.length, 0);
});

test("buyerSpokeLast tolerates number vs string ids", () => {
  assert.equal(buyerSpokeLast(conv({ to_id: 460819991, latest_message_from_id: "460819991" })), true);
});

test("buyerSpokeLast is false when the sender is unknown", () => {
  assert.equal(buyerSpokeLast(conv({ latest_message_from_id: undefined })), false);
});

test("nanosToMillis reads Shopee's 19-digit nanosecond timestamps", () => {
  // 1788855905137724700 ns == 1788855905137 ms
  assert.equal(nanosToMillis("1788855905137724700"), 1788855905137);
});

test("REGRESSION: nanoseconds must not be read as milliseconds", () => {
  // Read as ms this lands ~50 million years in the past, so every thread looks
  // ancient and the sweep escalates everything instead of replying.
  const ms = nanosToMillis("1788855905137724700");
  const ageYears = (Date.now() - ms) / (365 * 24 * 3_600_000);
  assert.ok(Math.abs(ageYears) < 5, `expected a recent timestamp, got ${ageYears} years`);
});

test("nanosToMillis normalises other magnitudes and rejects junk", () => {
  assert.equal(nanosToMillis(1788855905), 1788855905000); // seconds
  assert.equal(nanosToMillis(1788855905137), 1788855905137); // millis
  assert.equal(nanosToMillis(0), 0);
  assert.equal(nanosToMillis(undefined), 0);
  assert.equal(nanosToMillis("not-a-number"), 0);
});

// ── Reading the buyer's message ──────────────────────────────────────────

test("extractText unwraps Shopee's nested { text } and survives stickers", () => {
  assert.equal(extractText({ text: "hi" }), "hi");
  assert.equal(extractText("hi"), "hi");
  assert.equal(extractText(""), ""); // sticker / image carry no text
  assert.equal(extractText(undefined), "");
  assert.equal(extractText({ sticker_id: 3 }), "");
});

// ── Routing ──────────────────────────────────────────────────────────────

test("a login complaint is never answered with 'read the tutorial'", () => {
  assert.equal(classifyReply("cannot login, wrong password"), "login_trouble");
  assert.equal(classifyReply("steam guard code not working"), "login_trouble");
  assert.equal(classifyReply("i got kicked out"), "login_trouble");
  assert.equal(classifyReply("tak boleh masuk"), "login_trouble");
});

test("pre-purchase questions route to the pre-purchase template", () => {
  assert.equal(classifyReply("do you have elden ring?"), "pre_purchase");
  assert.equal(classifyReply("berapa harga"), "pre_purchase");
  assert.equal(classifyReply("is this original?"), "pre_purchase");
  assert.equal(classifyReply("ada stock?"), "pre_purchase");
});

test("post-purchase 'where is my code' routes to order help", () => {
  assert.equal(classifyReply("where is my order id"), "order_help");
  assert.equal(classifyReply("belum dapat"), "order_help");
});

test("anything ambiguous falls through to the honest holding reply", () => {
  assert.equal(classifyReply(""), "holding");
  assert.equal(classifyReply("hello"), "holding");
  assert.equal(classifyReply("???"), "holding");
});

// ── What the buyer reads ─────────────────────────────────────────────────

const ALL_KINDS = ["order_help", "login_trouble", "pre_purchase", "holding"] as const;

test("every reply carries the marker so the sweep can recognise its own work", () => {
  for (const k of ALL_KINDS) {
    assert.ok(buildReply(k).includes(AUTO_ASSIST_MARKER), `${k} is missing the marker`);
  }
});

test("no reply ever makes a forbidden claim", () => {
  // Claim rules, .claude/skills/ss-market/SKILL.md §1.
  const forbidden = [
    "instant",
    "lifetime",
    "life time",
    "guarantee",
    "refund",
    "play online",
    "online multiplayer",
    "multiplayer",
  ];
  for (const k of ALL_KINDS) {
    const body = buildReply(k).toLowerCase();
    for (const word of forbidden) {
      assert.ok(!body.includes(word), `${k} contains a forbidden claim: "${word}"`);
    }
  }
});

test("no reply links to /games while that URL redirects to the admin login", () => {
  // FACT-V 2026-09-08: https://www.gameshare.space/games -> 307 -> /admin/login.
  // Sending a buyer to a staff login form is worse than sending them nowhere.
  for (const k of ALL_KINDS) {
    assert.ok(!buildReply(k).includes("/games"), `${k} links to the unshipped /games page`);
  }
});

test("no reply ever names a second lookup field", () => {
  // The lookup form has taken an Order ID and nothing else since 2026-09-06.
  // Naming a username field is what drove buyers into chat in the first place.
  for (const k of ALL_KINDS) {
    const body = buildReply(k).toLowerCase();
    assert.ok(!body.includes("order id + username"), `${k} names a field that does not exist`);
  }
});

test("no reply leaks a credential", () => {
  for (const k of ALL_KINDS) {
    const body = buildReply(k).toLowerCase();
    assert.ok(!body.includes("password:"), `${k} looks like it carries a password`);
  }
});

// ── The loop guard ───────────────────────────────────────────────────────

function msg(from: string, text: string): ChatMessage {
  return { from_id: from, message_type: "text", content: { text } };
}

test("a buyer we have never replied to gets an auto-assist", () => {
  const messages = [msg(BUYER, "hello?"), msg(BUYER, "hi")]; // newest first
  assert.equal(alreadyAutoAssisted(messages, BUYER), false);
});

test("a buyer whose last answer from us was MANUAL still gets an auto-assist", () => {
  const messages = [msg(BUYER, "still broken"), msg(SHOP_CHAT_ID, "let me check for you")];
  assert.equal(alreadyAutoAssisted(messages, BUYER), false);
});

test("a buyer who already got an auto-assist and wrote again is NOT replied to twice", () => {
  const messages = [
    msg(BUYER, "that did not help"),
    msg(SHOP_CHAT_ID, `${AUTO_ASSIST_MARKER}\n\nYour details are in this chat`),
  ];
  assert.equal(alreadyAutoAssisted(messages, BUYER), true);
});

test("the guard skips the whole run of unanswered buyer messages, not just the newest", () => {
  const messages = [
    msg(BUYER, "hello???"),
    msg(BUYER, "are you there"),
    msg(BUYER, "that did not help"),
    msg(SHOP_CHAT_ID, `${AUTO_ASSIST_MARKER}\n\nYour details are in this chat`),
  ];
  assert.equal(alreadyAutoAssisted(messages, BUYER), true);
});

test("the follow-up message is NOT mistaken for an auto-assist", () => {
  // buildFollowUpMessage starts with "[GameShare]". If that counted as our
  // marker, every buyer replying to "please rate us" would be escalated
  // instead of answered.
  const messages = [
    msg(BUYER, "ok thanks"),
    msg(SHOP_CHAT_ID, "[GameShare]\nOrder ID: X\n\nAll delivered — enjoy the game!"),
  ];
  assert.equal(alreadyAutoAssisted(messages, BUYER), false);
});

test("unknown or empty history stays quiet and lets a human handle it", () => {
  assert.equal(alreadyAutoAssisted([], BUYER), true);
  assert.equal(alreadyAutoAssisted(undefined as unknown as ChatMessage[], BUYER), true);
});

// ── Selection ────────────────────────────────────────────────────────────

const NOW = 1_788_855_905_137;
const hoursAgoNanos = (h: number) => String((NOW - h * 3_600_000) * 1_000_000);

test("a message newer than minAgeMinutes is left for Chaison to answer in person", () => {
  const c = conv({ last_message_timestamp: String((NOW - 60_000) * 1_000_000) }); // 1 min
  const { candidates } = selectCandidates([c], NOW, { minAgeMinutes: 5, maxAgeHours: 12, ignoreOlderThanHours: 72 });
  assert.equal(candidates.length, 0);
});

test("a message past maxAgeHours is escalated, not auto-replied", () => {
  const c = conv({ last_message_timestamp: hoursAgoNanos(20) });
  const { candidates, stale } = selectCandidates([c], NOW, { minAgeMinutes: 5, maxAgeHours: 12, ignoreOlderThanHours: 72 });
  assert.equal(candidates.length, 0);
  assert.equal(stale.length, 1);
});

test("candidates come back newest first, so a capped run rescues the savable ones", () => {
  const convs = [
    conv({ conversation_id: "old", last_message_timestamp: hoursAgoNanos(9) }),
    conv({ conversation_id: "new", last_message_timestamp: hoursAgoNanos(1) }),
    conv({ conversation_id: "mid", last_message_timestamp: hoursAgoNanos(4) }),
  ];
  const { candidates } = selectCandidates(convs, NOW, { minAgeMinutes: 5, maxAgeHours: 12, ignoreOlderThanHours: 72 });
  assert.deepEqual(
    candidates.map((c) => c.conversationId),
    ["new", "mid", "old"],
  );
});

test("an ancient thread is ignored entirely — not replied to, not escalated forever", () => {
  // The first live dry run (2026-09-08) found threads aged 2,021h / 8,570h /
  // 8,921h: a year-old "Yes", another shop's auto-reply, and a scam message.
  // Without an upper bound these are flagged ACTION REQUIRED on every run for
  // the rest of time, which trains the operator to ignore the alert.
  const ancient = [
    conv({ conversation_id: "a", last_message_timestamp: hoursAgoNanos(8921) }),
    conv({ conversation_id: "b", last_message_timestamp: hoursAgoNanos(2021) }),
  ];
  const { candidates, stale } = selectCandidates(ancient, NOW, {
    minAgeMinutes: 5,
    maxAgeHours: 12,
    ignoreOlderThanHours: 72,
  });
  assert.equal(candidates.length, 0);
  assert.equal(stale.length, 0);
});

test("a thread inside the escalation band is still escalated", () => {
  const c = conv({ last_message_timestamp: hoursAgoNanos(30) });
  const { candidates, stale } = selectCandidates([c], NOW, {
    minAgeMinutes: 5,
    maxAgeHours: 12,
    ignoreOlderThanHours: 72,
  });
  assert.equal(candidates.length, 0);
  assert.equal(stale.length, 1);
});

test("a conversation with no usable timestamp is skipped rather than guessed at", () => {
  const c = conv({ last_message_timestamp: undefined });
  const { candidates, stale } = selectCandidates([c], NOW, { minAgeMinutes: 5, maxAgeHours: 12, ignoreOlderThanHours: 72 });
  assert.equal(candidates.length + stale.length, 0);
});

test("selection carries the routed template through", () => {
  const c = conv({
    last_message_timestamp: hoursAgoNanos(2),
    latest_message_content: { text: "cannot login wrong password" },
  });
  const { candidates } = selectCandidates([c], NOW, { minAgeMinutes: 5, maxAgeHours: 12, ignoreOlderThanHours: 72 });
  assert.equal(candidates[0].kind, "login_trouble");
});

// ── composeReply: body + marker + optional rating ask ─────────────────────

test("composeReply stamps the marker so the loop guard recognises its own work", () => {
  assert.ok(composeReply("hello", false).startsWith(AUTO_ASSIST_MARKER));
});

test("composeReply appends the rating ask only when asked", () => {
  assert.ok(!composeReply("hello", false).includes("⭐⭐⭐⭐⭐"));
  assert.ok(composeReply("hello", true).includes(RATING_ASK.trim()));
});

// ── resolveAiMode: the send/preview/off decision ──────────────────────────

test("no API key means templates, whatever the flags say", () => {
  assert.equal(resolveAiMode({ hasKey: false, envFlag: "true", dryRun: false, aiParam: true }), "off");
});

test("a live run sends AI only when SHOPEE_CHAT_AI is exactly 'true'", () => {
  assert.equal(resolveAiMode({ hasKey: true, envFlag: "true", dryRun: false, aiParam: false }), "send");
  assert.equal(resolveAiMode({ hasKey: true, envFlag: "false", dryRun: false, aiParam: false }), "off");
  assert.equal(resolveAiMode({ hasKey: true, envFlag: undefined, dryRun: false, aiParam: false }), "off");
});

test("a query parameter can only ever PREVIEW, never send live", () => {
  // dryRun + ai=1 previews AI drafts; ai=1 without dryRun cannot send.
  assert.equal(resolveAiMode({ hasKey: true, envFlag: "false", dryRun: true, aiParam: true }), "preview");
  assert.equal(resolveAiMode({ hasKey: true, envFlag: "false", dryRun: true, aiParam: false }), "off");
});
