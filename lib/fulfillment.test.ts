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

test("includes the order id, the steam username and the game title", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.includes(SAMPLE.orderSn), "order id missing");
  assert.ok(message.includes(SAMPLE.steamUsername), "steam username missing");
  assert.ok(message.includes(SAMPLE.gameTitle), "game title missing");
});

test("leads with the [Auto Delivery] header", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.startsWith("[Auto Delivery] "));
});

test("links the site, the tutorial and the terms", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.includes("https://gameshare.space"));
  assert.ok(message.includes("https://gameshare.space/tutorial"));
  assert.ok(message.includes("https://gameshare.space/terms"));
});

test("points at the real tutorial anchors for steps 4 and 6", () => {
  // These ids exist in app/tutorial/page.tsx (id="step-4" / id="step-6").
  const message = buildDeliveryMessage(SAMPLE);
  assert.ok(message.includes("https://gameshare.space/tutorial#step-4"));
  assert.ok(message.includes("https://gameshare.space/tutorial#step-6"));
  assert.match(message, /Step 4/);
  assert.match(message, /Step 6/);
  assert.match(message, /Steam Cloud/);
  assert.match(message, /Offline Mode/);
});

// ── The security-relevant assertions ─────────────────────────────────────
// Shopee chat is a permanent third-party record. If someone ever adds the
// account password (or a Steam Guard code) to this message, these fail.

test("never carries a labelled password", () => {
  const message = buildDeliveryMessage(SAMPLE);
  // Matches "Password: hunter2", "password =hunter2", etc. The message is
  // allowed to say the WORD password (it tells the buyer where to get one);
  // what it must never do is label a value with it.
  assert.doesNotMatch(message, /password\s*[:=]/i);
});

test("never carries a labelled Steam Guard code", () => {
  const message = buildDeliveryMessage(SAMPLE);
  assert.doesNotMatch(message, /(?:guard|auth|2fa|otp)\s*code\s*[:=]/i);
  // Steam Guard codes are exactly 5 chars from this alphabet. A bare token of
  // that shape anywhere in the message means a code got pasted in.
  assert.doesNotMatch(message, /\b[23456789BCDFGHJKMNPQRTVWXY]{5}\b/);
});

test("does not echo any secret it was never given", () => {
  // Defence against a future signature change: if someone widens the input to
  // accept a password, the object below would start leaking. Passing extra
  // keys must not change the output.
  const withExtra = {
    ...SAMPLE,
    password: "hunter2-not-a-real-password",
  } as Parameters<typeof buildDeliveryMessage>[0];
  const message = buildDeliveryMessage(withExtra);
  assert.ok(!message.includes("hunter2-not-a-real-password"));
  assert.equal(message, buildDeliveryMessage(SAMPLE));
});

test("labels no credential beyond the order id and steam username", () => {
  // app/page.tsx asks for Order ID + Steam username, and that is the entire
  // credential surface this message is allowed to have.
  const message = buildDeliveryMessage(SAMPLE);
  const labels = message
    .split("\n")
    .map((line) => /^([A-Za-z][A-Za-z ]*?):\s/.exec(line)?.[1])
    .filter((label): label is string => Boolean(label));

  assert.ok(labels.includes("Order ID"), `labels were: ${labels.join(", ")}`);
  assert.ok(labels.includes("Steam User"), `labels were: ${labels.join(", ")}`);
  for (const label of labels) {
    assert.doesNotMatch(label, /pass|secret|token|guard|pin|code|login/i);
  }
});
