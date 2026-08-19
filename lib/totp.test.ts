import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSteamGuardCode } from "./totp.ts";

// Verified test vector: 20-byte secret (all bytes = 0x01), base64-encoded.
const TEST_SECRET = "AQEBAQEBAQEBAQEBAQEBAQEBAQE=";

test("generates the expected code for a known secret and timestamp", async () => {
  const code = await generateSteamGuardCode(TEST_SECRET, 1700000000);
  assert.equal(code, "73FVW");
});

test("is deterministic within the same 30-second window", async () => {
  const a = await generateSteamGuardCode(TEST_SECRET, 1700000000);
  const b = await generateSteamGuardCode(TEST_SECRET, 1700000005);
  assert.equal(a, b);
});

test("changes in the next 30-second window", async () => {
  const a = await generateSteamGuardCode(TEST_SECRET, 1700000000);
  const b = await generateSteamGuardCode(TEST_SECRET, 1700000030);
  assert.equal(b, "F8XD9");
  assert.notEqual(a, b);
});

test("returns a 5-character code using only the Steam Guard alphabet", async () => {
  const code = await generateSteamGuardCode(TEST_SECRET, 1700000000);
  assert.equal(code.length, 5);
  assert.match(code, /^[23456789BCDFGHJKMNPQRTVWXY]{5}$/);
});
