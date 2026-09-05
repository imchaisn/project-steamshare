import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeliveryMessage } from "./fulfillment.ts";

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
    assert.match(message, /enter the Order ID \+ Username above/);
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
