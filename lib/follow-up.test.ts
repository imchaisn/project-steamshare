import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOLLOW_UP_DELAY_HOURS,
  FOLLOW_UP_MAX_AGE_DAYS,
  buildFollowUpMessage,
  followUpWindow,
} from "./follow-up.ts";

// Same coverage boundary as lib/fulfillment.test.ts: the pure, buyer-visible
// half is tested here. sendPendingFollowUps() talks to Supabase and to Shopee
// on every path and this repo has no test double for either, so it is flagged
// in its own doc comment rather than faked.

const ORDER_SN = "250903ABCDEFGH";

// ── The message ──────────────────────────────────────────────────────────

test("includes the order id", () => {
  assert.ok(buildFollowUpMessage({ orderSn: ORDER_SN }).includes(ORDER_SN));
});

test("leads with the [GameShare] header and the order id on line 2", () => {
  const lines = buildFollowUpMessage({ orderSn: ORDER_SN }).split("\n");
  assert.equal(lines[0], "[GameShare]");
  assert.equal(lines[1], `Order ID: ${ORDER_SN}`);
});

test("asks for the receipt confirmation in both languages", () => {
  const message = buildFollowUpMessage({ orderSn: ORDER_SN });
  // The English label is the literal button in Shopee's UI; the Malay one is
  // the same button for a buyer with the app in BM. Both must be quoted
  // exactly or the buyer hunts for a control that is not named that.
  assert.match(message, /"Order Received"/);
  assert.match(message, /"Pesanan Diterima"/);
});

test("asks for the rating in both languages", () => {
  const message = buildFollowUpMessage({ orderSn: ORDER_SN });
  assert.match(message, /5-star rating/);
  assert.match(message, /beri rating/);
});

test("offers nothing in exchange for the rating", () => {
  // Shopee treats an incentivised review as a listing violation. This test is
  // the guard on that: no discount, refund, voucher or gift may ever appear
  // in the same message that asks for stars.
  const message = buildFollowUpMessage({ orderSn: ORDER_SN }).toLowerCase();
  for (const bait of ["discount", "voucher", "free game", "refund", "cashback", "gift"]) {
    assert.ok(!message.includes(bait), `follow-up must not offer "${bait}" for a rating`);
  }
});

test("routes problems to chat before they become a rating", () => {
  const message = buildFollowUpMessage({ orderSn: ORDER_SN });
  assert.match(message, /message us here first/i);
  assert.ok(message.includes("https://www.gameshare.space/tutorial#step-7"));
});

test("uses the www host everywhere, never the bare apex", () => {
  // The apex 308-redirects to www and this is opened in Shopee's in-app
  // webview, where the extra hop is a real failure mode.
  assert.doesNotMatch(buildFollowUpMessage({ orderSn: ORDER_SN }), /https:\/\/gameshare\.space/);
});

test("carries no credential of any kind", () => {
  // The follow-up is sent a day late into a chat thread that already holds
  // the credentials. It must never restate them: it takes no username and no
  // password, and it must not grow a label for one either.
  const message = buildFollowUpMessage({ orderSn: ORDER_SN });
  assert.doesNotMatch(message, /password/i);
  assert.doesNotMatch(message, /username/i);
  assert.doesNotMatch(message, /guard code/i);
});

test("refuses to build a message with no order id", () => {
  // "[GameShare] Order ID:" with nothing after it reaching a buyer is worse
  // than a follow-up that never sends, so this throws rather than degrades.
  assert.throws(() => buildFollowUpMessage({ orderSn: "   " }), /order id/i);
});

// ── The window ───────────────────────────────────────────────────────────

test("becomes eligible exactly FOLLOW_UP_DELAY_HOURS after delivery", () => {
  const now = new Date("2026-09-10T04:00:00.000Z");
  const { readyBefore } = followUpWindow(now);
  assert.equal(
    readyBefore,
    new Date(now.getTime() - FOLLOW_UP_DELAY_HOURS * 3_600_000).toISOString(),
  );
});

test("stops chasing orders that are near Shopee's 30-day contact limit", () => {
  const now = new Date("2026-09-10T04:00:00.000Z");
  const { notOlderThan } = followUpWindow(now);
  assert.equal(
    notOlderThan,
    new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * 86_400_000).toISOString(),
  );
  // A shop may only message a buyer within 30 days of the order. Anything at
  // or past that fails user_is_forbidden, so the cutoff must stay under it
  // with room for the delivery-to-order lag.
  assert.ok(FOLLOW_UP_MAX_AGE_DAYS < 30);
});

test("leaves a usable window between eligible and too old", () => {
  const now = new Date("2026-09-10T04:00:00.000Z");
  const { readyBefore, notOlderThan } = followUpWindow(now);
  assert.ok(notOlderThan < readyBefore, "the window must not be inverted");
});
