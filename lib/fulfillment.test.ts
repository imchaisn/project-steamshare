import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountMaxBuyers,
  buildDeliveryMessage,
  buildReceiptNudgeMessage,
  chooseAccountGame,
  matchItemsToGames,
  shouldSendReceiptNudge,
  type AllocationCandidate,
} from "./fulfillment.ts";

// Only buildDeliveryMessage is covered here. fulfillOrder() talks to Supabase
// on every path, and this repo has no test double for createAdminClient() and
// no mocking dependency — adding one is a bigger decision than this task, so
// it is flagged rather than faked. The delivery message is the part that is
// pure, is buyer-visible, and is the one place a credential could leak.

const SAMPLE = {
  gameTitle: "Elden Ring",
  orderSn: "250903ABCDEFGH",
  steamUsername: "steamshare_er_01",
};

// A lowercase-containing password on purpose: it cannot collide with the
// Steam Guard alphabet check below, so that assertion keeps testing what it
// claims to rather than passing by luck.
const PASSWORD = "not-a-real-password-9x";
const SAMPLE_WITH_PASSWORD = { ...SAMPLE, steamPassword: PASSWORD };

test("includes the order id, the steam username and the game title", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.includes(SAMPLE.orderSn), "order id missing");
  assert.ok(message.includes(SAMPLE.steamUsername), "steam username missing");
  assert.ok(message.includes(SAMPLE.gameTitle), "game title missing");
});

test("leads with the [Auto Delivery] header, game title on its own line", () => {
  const message = buildDeliveryMessage(SAMPLE);
  const lines = message.split("\n");
  assert.equal(lines[0], "[Auto Delivery]");
  assert.equal(lines[1], SAMPLE.gameTitle);
});

// ── Links ────────────────────────────────────────────────────────────────
// Every URL uses the www host. The apex 308-redirects to www, and these are
// pasted into a Shopee chat that buyers often open in an in-app webview,
// where an extra redirect hop is a real failure mode rather than a nicety.

test("links the site, the tutorial and the troubleshooting anchor", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.includes("https://www.gameshare.space"));
  assert.ok(message.includes("https://www.gameshare.space/tutorial"));
  assert.ok(message.includes("https://www.gameshare.space/tutorial#step-7"));
});

test("links the Denuvo first-launch block, which the go-offline warning contradicts", () => {
  const message = buildDeliveryMessage(SAMPLE);
  // #denuvo, not #step-7: the buyer needs the one exception to the "go offline
  // every session" line this same message ends with, and it must land on the
  // always-visible block rather than a collapsed <details>.
  assert.ok(message.includes("https://www.gameshare.space/tutorial#denuvo"));
});

test("uses the www host everywhere, never the bare apex", () => {
  const message = buildDeliveryMessage(SAMPLE_WITH_PASSWORD);
  // Any gameshare.space URL not preceded by "www." is a redirect hop.
  assert.doesNotMatch(message, /https:\/\/gameshare\.space/);
});

test("carries the bilingual every-session warning", () => {
  const message = buildDeliveryMessage(SAMPLE);
  // Both languages are required: a material share of buyers read the Malay
  // line first, and these two steps are the ones that corrupt other buyers'
  // saves when skipped.
  assert.match(message, /EVERY session: Step 4 \(Steam Cloud OFF\) \+ Step 6 \(Go Offline\)\./);
  assert.match(message, /SETIAP sesi: Langkah 4 \(Steam Cloud OFF\) \+ Langkah 6 \(Go Offline\)\./);
});

// ── The security-relevant assertions ─────────────────────────────────────
// This message DOES carry the account password, by Chaison's decision of
// 2026-09-05 (reasoning and costs are in buildDeliveryMessage's docblock).
// These tests no longer forbid a password — they pin down exactly WHICH
// credentials are allowed, so widening that set has to be deliberate.

test("includes the password when one is supplied", () => {
  const message = buildDeliveryMessage(SAMPLE_WITH_PASSWORD);
  assert.ok(message.includes(PASSWORD), "password missing from the message");
  assert.match(message, /^Password: /m);
});

test("omits the password line entirely when none is supplied", () => {
  // A decrypt failure or a missing password_enc must degrade to a message
  // WITHOUT a password, never to "Password: null" reaching a buyer.
  for (const value of [undefined, null, ""]) {
    const message = buildDeliveryMessage({ ...SAMPLE, steamPassword: value });
    assert.doesNotMatch(message, /^Password: /m, `leaked a password line for ${String(value)}`);
    assert.doesNotMatch(message, /null|undefined/, `leaked a placeholder for ${String(value)}`);
  }
});

test("always points at the site for the code, even when it carries the password", () => {
  // The site stays the authority: the Guard code only exists there, and a
  // rotated password only shows up there. If this line ever disappears, a
  // password rotation silently strands every buyer holding an old message.
  for (const sample of [SAMPLE, SAMPLE_WITH_PASSWORD]) {
    const message = buildDeliveryMessage(sample);
    assert.match(message, /Password \+ code: https:\/\/www\.gameshare\.space/);
    assert.match(message, /enter the Order ID above/);
    // The form takes an order id and nothing else (app/page.tsx has one input).
    // This assertion previously required "Order ID + Username", pinning an
    // instruction that stopped being true on 2026-09-06 — so the test was
    // holding the bug in place. Naming a second field here is the regression.
    assert.doesNotMatch(message, /enter the Order ID \+ Username/i);
  }
});

test("never carries a labelled Steam Guard code", () => {
  // Non-negotiable: a 30-second code is worthless in a static message, so
  // its presence can only mean a bug.
  for (const sample of [SAMPLE, SAMPLE_WITH_PASSWORD]) {
    const message = buildDeliveryMessage(sample);
    assert.doesNotMatch(message, /(?:guard|auth|2fa|otp)\s*code\s*[:=]/i);
    // Steam Guard codes are exactly 5 chars from this alphabet. A bare token
    // of that shape anywhere in the message means a code got pasted in.
    assert.doesNotMatch(message, /\b[23456789BCDFGHJKMNPQRTVWXY]{5}\b/);
  }
});

test("does not echo any secret it was never given", () => {
  // Passing keys the function does not declare must not change the output.
  // `password` (rather than `steamPassword`) is deliberately the wrong name:
  // if someone renames the field without updating callers, this catches the
  // silent "no password ever sent" regression instead of it going unnoticed.
  const withExtra = {
    ...SAMPLE,
    password: "hunter2-not-a-real-password",
    sharedSecret: "JBSWY3DPEHPK3PXP",
  } as Parameters<typeof buildDeliveryMessage>[0];
  const message = buildDeliveryMessage(withExtra);
  assert.ok(!message.includes("hunter2-not-a-real-password"));
  assert.ok(!message.includes("JBSWY3DPEHPK3PXP"));
  assert.equal(message, buildDeliveryMessage(SAMPLE));
});

test("labels no credential beyond order id, steam username and password", () => {
  // The complete allowed credential surface, enumerated. Anything else that
  // acquires a "Label: value" line — a Guard secret, a recovery email, a
  // token — fails here rather than reaching a buyer's permanent chat log.
  //
  // Only labels that LOOK credential-bearing are checked against the allow
  // list; the emoji-prefixed link lines are not matched by the label regex
  // at all, since it anchors on a leading ASCII letter.
  const ALLOWED = new Set(["Order ID", "Username", "Password"]);
  const CREDENTIAL_ISH = /\b(pass|password|secret|token|guard|pin|code|login|auth|key)\b/i;

  const message = buildDeliveryMessage(SAMPLE_WITH_PASSWORD);
  const labels = message
    .split("\n")
    .map((line) => /^([A-Za-z][A-Za-z ]*?):\s/.exec(line)?.[1])
    .filter((label): label is string => Boolean(label));

  assert.ok(labels.includes("Order ID"), `labels were: ${labels.join(", ")}`);
  assert.ok(labels.includes("Username"), `labels were: ${labels.join(", ")}`);
  assert.ok(labels.includes("Password"), `labels were: ${labels.join(", ")}`);
  for (const label of labels) {
    if (CREDENTIAL_ISH.test(label)) {
      assert.ok(ALLOWED.has(label), `unexpected credential label in the message: "${label}"`);
    }
  }
});

// ── Waterfall allocation: fill one account, then swap ──────────────────────
//
// Chaison's call, 2026-09-06, replacing least-loaded spreading. Concentrating
// buyers onto one account until it is full leaves the others pristine, so
// there is always a clean account to move a complaining buyer to.

const wukong: AllocationCandidate[] = [
  { id: "acct-1", created_at: "2026-01-01T00:00:00Z" },
  { id: "acct-2", created_at: "2026-01-02T00:00:00Z" },
  { id: "acct-3", created_at: "2026-01-03T00:00:00Z" },
];

test("an empty pool allocates nothing", () => {
  assert.equal(chooseAccountGame([], new Map(), 5), null);
});

test("the first account takes every buyer until it is full", () => {
  // The whole point: buyers pile onto acct-1, not spread across all three.
  for (let sold = 0; sold < 5; sold++) {
    const load = new Map([["acct-1", sold]]);
    assert.equal(
      chooseAccountGame(wukong, load, 5),
      "acct-1",
      `with ${sold} sold, acct-1 should still be taking buyers`,
    );
  }
});

test("it swaps to the next account the moment the first hits the cap", () => {
  assert.equal(chooseAccountGame(wukong, new Map([["acct-1", 5]]), 5), "acct-2");
});

test("it keeps walking down the pool as each fills", () => {
  const load = new Map([
    ["acct-1", 5],
    ["acct-2", 5],
  ]);
  assert.equal(chooseAccountGame(wukong, load, 5), "acct-3");
});

test("which account fills first is stable, not dependent on input order", () => {
  // Oldest account_games row first, then id. Anyone asking "which account is
  // in use right now" must get the same answer every time.
  const shuffled = [wukong[2], wukong[0], wukong[1]];
  assert.equal(chooseAccountGame(shuffled, new Map(), 5), "acct-1");
});

test("a paid buyer is NEVER refused when every account is full", () => {
  // Refusing a login to honour a self-imposed limit is the worse failure —
  // they have already paid. Overflow shows up in /admin as a count above the
  // cap, which is the signal to buy another account.
  const load = new Map([
    ["acct-1", 9],
    ["acct-2", 6],
    ["acct-3", 7],
  ]);
  assert.equal(
    chooseAccountGame(wukong, load, 5),
    "acct-2",
    "should overflow onto the least crowded account, not return null",
  );
});

test("a single-account game still works", () => {
  const solo = [wukong[0]];
  assert.equal(chooseAccountGame(solo, new Map(), 5), "acct-1");
  assert.equal(chooseAccountGame(solo, new Map([["acct-1", 99]]), 5), "acct-1");
});

test("ACCOUNT_MAX_BUYERS overrides the default, and junk falls back to it", () => {
  const prev = process.env.ACCOUNT_MAX_BUYERS;
  try {
    process.env.ACCOUNT_MAX_BUYERS = "2";
    assert.equal(accountMaxBuyers(), 2);
    for (const junk of ["0", "-3", "abc", ""]) {
      process.env.ACCOUNT_MAX_BUYERS = junk;
      assert.equal(accountMaxBuyers(), 5, `"${junk}" should fall back to 5`);
    }
  } finally {
    if (prev === undefined) delete process.env.ACCOUNT_MAX_BUYERS;
    else process.env.ACCOUNT_MAX_BUYERS = prev;
  }
});

/* ------------------------------------------------------------------------ */
/* matchItemsToGames — multi-game orders                                     */
/* ------------------------------------------------------------------------ */

/*
 * These exist because of a real, silent data-loss bug. Shopee splits a cart
 * by SHOP, not by item, so four games bought in one checkout arrive as ONE
 * order_sn with four entries in item_list. The previous mapItemsToGame()
 * returned on the FIRST item that resolved and dropped the rest — the buyer
 * paid for four games and got one, and the fulfilment status was `created`,
 * so nothing in the logs said otherwise.
 *
 * The assertion that matters most in this block is that nothing is EVER
 * silently discarded: every input item must come back in either `matched` or
 * `unmatched`.
 */

const LISTINGS = [
  { item_id: 101, model_id: 0, game_id: "game-truck" },
  { item_id: 102, model_id: 0, game_id: "game-diver" },
  { item_id: 103, model_id: 55, game_id: "game-sekiro" },
  { item_id: 104, model_id: 0, game_id: "game-thronefall" },
];

const item = (itemId: number, modelId = 0) => ({ itemId, modelId });

test("a four-game order maps ALL four, in the order Shopee listed them", () => {
  const { matched, unmatched } = matchItemsToGames(
    [item(101), item(102), item(103, 55), item(104)],
    LISTINGS,
  );
  assert.deepEqual(
    matched.map((m) => m.gameId),
    ["game-truck", "game-diver", "game-sekiro", "game-thronefall"],
  );
  assert.equal(unmatched.length, 0);
});

test("a single-game order behaves exactly as before", () => {
  const { matched, unmatched } = matchItemsToGames([item(101)], LISTINGS);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].gameId, "game-truck");
  assert.equal(unmatched.length, 0);
});

test("an unmapped item is REPORTED, never silently dropped", () => {
  // The exact shape of the old bug: three sellable games and one listing
  // nobody has mapped yet. The three must still be served and the fourth must
  // be visible to ops.
  const { matched, unmatched } = matchItemsToGames(
    [item(101), item(999), item(102), item(104)],
    LISTINGS,
  );
  assert.deepEqual(
    matched.map((m) => m.gameId),
    ["game-truck", "game-diver", "game-thronefall"],
  );
  assert.deepEqual(
    unmatched.map((u) => u.itemId),
    [999],
  );
});

test("every input item is accounted for in exactly one bucket", () => {
  const items = [item(101), item(999), item(103, 55), item(888), item(102)];
  const { matched, unmatched } = matchItemsToGames(items, LISTINGS);
  assert.equal(
    matched.length + unmatched.length,
    items.length,
    "an item went missing — this is the bug this function exists to prevent",
  );
});

test("nothing maps at all -> empty matched, every item reported", () => {
  const { matched, unmatched } = matchItemsToGames([item(998), item(999)], LISTINGS);
  assert.equal(matched.length, 0);
  assert.equal(unmatched.length, 2, "no_mapping must still name what was bought");
});

test("an empty order maps nothing and reports nothing", () => {
  const { matched, unmatched } = matchItemsToGames([], LISTINGS);
  assert.equal(matched.length, 0);
  assert.equal(unmatched.length, 0);
});

test("exact (item_id, model_id) wins over the no-variation fallback", () => {
  const listings = [
    { item_id: 103, model_id: 0, game_id: "game-fallback" },
    { item_id: 103, model_id: 55, game_id: "game-sekiro" },
  ];
  const { matched } = matchItemsToGames([item(103, 55)], listings);
  assert.equal(matched[0].gameId, "game-sekiro");
});

test("an unknown model_id falls back to the (item_id, 0) listing", () => {
  const { matched, unmatched } = matchItemsToGames([item(101, 777)], LISTINGS);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].gameId, "game-truck");
  assert.equal(unmatched.length, 0);
});

test("two line items for the SAME game allocate once, and are not flagged", () => {
  // A buyer who bought the standard and deluxe listings of one title. The
  // product is access to an account that owns the game, so a second account
  // would be two logins for one thing to play. It mapped fine, so it must NOT
  // appear in `unmatched` — that would raise a false ACTION REQUIRED.
  const listings = [
    { item_id: 101, model_id: 0, game_id: "game-truck" },
    { item_id: 201, model_id: 0, game_id: "game-truck" },
  ];
  const { matched, unmatched } = matchItemsToGames([item(101), item(201)], listings);
  assert.equal(matched.length, 1, "one game, one allocation");
  assert.equal(matched[0].gameId, "game-truck");
  assert.equal(unmatched.length, 0, "a duplicate game is not an ops problem");
});

test("the matched item carries the line item it came from", () => {
  // fulfillOrder() writes shopee_item_id/shopee_model_id from this, which is
  // what makes a Shopee retry idempotent against 0014's partial unique index.
  const { matched } = matchItemsToGames([item(103, 55)], LISTINGS);
  assert.equal(matched[0].item.itemId, 103);
  assert.equal(matched[0].item.modelId, 55);
});

test("no listings at all is a normal outcome, not a throw", () => {
  const { matched, unmatched } = matchItemsToGames([item(101)], []);
  assert.equal(matched.length, 0);
  assert.equal(unmatched.length, 1);
});

/* ------------------------------------------------------------------------ */
/* buildReceiptNudgeMessage — the "press Order Received" message that        */
/* follows the delivery message(s) in the SAME webhook request               */
/* ------------------------------------------------------------------------ */

const NUDGE_ORDER_SN = "250903ABCDEFGH";
const nudge = () => buildReceiptNudgeMessage({ orderSn: NUDGE_ORDER_SN });

test("nudge: leads with the [GameShare] header and the order id on line 2", () => {
  const lines = nudge().split("\n");
  assert.equal(lines[0], "[GameShare]");
  assert.equal(lines[1], `Order ID: ${NUDGE_ORDER_SN}`);
});

test("nudge: asks for Order Received in both languages, by its literal label", () => {
  // Quoted exactly, because these are the Shopee UI button names a buyer is
  // being told to look for. Paraphrasing sends them hunting for a control
  // that is not called that in their app.
  assert.match(nudge(), /"Order Received"/);
  assert.match(nudge(), /"Pesanan Diterima"/);
});

test("nudge: conditions the ask on the login actually working", () => {
  // Pressing Order Received releases escrow and closes the buyer's dispute
  // window. This message lands seconds after the credentials, before they
  // have tried them once, so the ask MUST stay conditional — see
  // buildReceiptNudgeMessage's docblock. Shortening this to a bare "please
  // tap Order Received" is the change this test exists to block.
  assert.match(nudge(), /once you've logged in and the game is working/i);
  assert.match(nudge(), /setelah log masuk dan game berfungsi/i);
});

test("nudge: asks for the 5-star rating in both languages", () => {
  // Chaison's call 2026-09-08, made after seeing both templates rendered: the
  // button and the stars go out together, immediately, in ONE message.
  // ⚠️ This is the assertion that inverted. It previously pinned the OPPOSITE
  // — that no star word appeared here, because the stars lived on the 24h
  // follow-up. If a future session finds buildFollowUpMessage() and this both
  // asking for stars, that is not a bug to fix by deleting one ask: it means
  // SHOPEE_FOLLOW_UP was left `true` in Vercel. See the docblock.
  assert.match(nudge(), /5-star\s+rating/);
  assert.match(nudge(), /beri rating/);
  assert.match(nudge(), /⭐⭐⭐⭐⭐/);
});

test("nudge: offers nothing in exchange for the rating", () => {
  // This is now the message that ASKS for the stars, so the rule binds harder
  // here than when the ask lived a day away: any of these words in this text
  // is money offered in the same breath as a star request. The sanctioned
  // lever is a Chat Broadcast to the `User Pending Review` group, and the
  // RM1/RM5 voucher is deliberately NOT gated on leaving a review — see
  // docs/promotions-and-bundles.md § 6a. Attaching it here would reintroduce
  // that gating under another name.
  const message = nudge().toLowerCase();
  for (const bait of ["discount", "voucher", "free game", "refund", "cashback", "gift", "rebate"]) {
    assert.ok(!message.includes(bait), `receipt nudge must not offer "${bait}"`);
  }
});

/** The Shopee Coins paragraphs of the nudge — EN first, then BM. */
const coinParagraphs = () =>
  nudge()
    .split("\n\n")
    .filter((p) => /Shopee Coins|Syiling Shopee/.test(p));

test("nudge: reminds the buyer of Shopee's review coins in both languages", () => {
  // Chaison, 2026-09-14. Shopee funds these, not the shop — see the docblock.
  // Naming Shopee as the payer is what keeps this a reminder, not our offer.
  const [en, bm] = coinParagraphs();
  assert.ok(en && bm, "expected an EN and a BM coin paragraph");
  assert.match(en, /Shopee\s+itself\s+gives\s+up\s+to\s+5\s+Shopee\s+Coins/);
  assert.match(bm, /Shopee\s+sendiri\s+beri\s+sehingga\s+5\s+Syiling\s+Shopee/);
});

test("nudge: states Shopee's coin criteria in full, not the easy half", () => {
  // The 5-coin tier needs 50+ characters AND a photo AND a video. Dropping
  // any part promises a buyer coins that never arrive.
  const [en, bm] = coinParagraphs();
  assert.match(en, /50\+\s+characters,\s+a\s+photo\s+AND\s+a\s+video/);
  assert.match(bm, /50\+\s+aksara\s+bersama\s+gambar\s+DAN\s+video/);
});

test("nudge: the coin line never depends on the star level", () => {
  // Shopee pays for review content, never for stars. A coin sentence that
  // mentions stars reads as "5 stars -> coins": the incentivised pattern.
  for (const p of coinParagraphs()) {
    assert.doesNotMatch(p, /⭐|star|bintang/i);
    assert.match(p, /any\s+review|sebarang\s+ulasan/);
  }
});

test("nudge: warns buyers off posting login details in a review photo", () => {
  // Review photos are public, and the obvious "proof it works" screenshot is
  // this chat thread, which holds a shared account's password.
  const [en, bm] = coinParagraphs();
  assert.match(en, /never\s+your\s+login\s+details/i);
  assert.match(bm, /jangan\s+tunjuk\s+maklumat\s+log\s+masuk/i);
});

test("nudge: carries no credential of any kind", () => {
  // The delivery message immediately above it in the same thread already
  // carries the username and password. Every extra copy is another permanent
  // record of a SHARED account's password in a log we cannot redact.
  const message = nudge();
  assert.doesNotMatch(message, /password/i);
  assert.doesNotMatch(message, /username/i);
  assert.doesNotMatch(message, /guard code/i);
});

test("nudge: routes problems to chat before they become a rating", () => {
  assert.match(nudge(), /message us here first/i);
  assert.ok(nudge().includes("https://www.gameshare.space/tutorial#step-7"));
});

test("nudge: uses the www host, never the bare apex", () => {
  // The apex 308-redirects to www, and this opens in Shopee's in-app webview
  // where the extra hop is a real failure mode.
  assert.doesNotMatch(nudge(), /https:\/\/gameshare\.space/);
});

test("nudge: refuses to build a message with no order id", () => {
  assert.throws(() => buildReceiptNudgeMessage({ orderSn: "   " }), /order id/i);
});

/* -------------------------------------------------------------------------- */
/* shouldSendReceiptNudge — the nudge claims everything was sent               */
/* -------------------------------------------------------------------------- */

test("nudge gate: sends when every game on the order just went out", () => {
  const input = { status: "created", gameCount: 2, justDelivered: 2 } as const;
  assert.equal(shouldSendReceiptNudge(input), true);
});

test("nudge gate: a partial order is never told everything was sent", () => {
  const input = { status: "partial", gameCount: 2, justDelivered: 2 } as const;
  assert.equal(shouldSendReceiptNudge(input), false);
});

test("nudge gate: one failed send on a multi-game order blocks it", () => {
  const input = { status: "created", gameCount: 3, justDelivered: 2 } as const;
  assert.equal(shouldSendReceiptNudge(input), false);
});

test("nudge gate: a retry that finishes a failed send stays silent", () => {
  const input = { status: "already_exists", gameCount: 3, justDelivered: 1 } as const;
  assert.equal(shouldSendReceiptNudge(input), false);
});

test("nudge gate: a retry that delivered nothing stays silent", () => {
  const input = { status: "already_exists", gameCount: 2, justDelivered: 0 } as const;
  assert.equal(shouldSendReceiptNudge(input), false);
});

test("nudge gate: no games is not a full delivery", () => {
  const input = { status: "created", gameCount: 0, justDelivered: 0 } as const;
  assert.equal(shouldSendReceiptNudge(input), false);
});
