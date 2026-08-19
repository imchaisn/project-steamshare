import { test } from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "./encryption.ts";

test("encrypt then decrypt returns the original plaintext", async () => {
  const plaintext = "correct horse battery staple";
  const ciphertext = await encrypt(plaintext);
  const result = await decrypt(ciphertext);
  assert.equal(result, plaintext);
});

test("encrypting the same plaintext twice produces different ciphertext (random IV)", async () => {
  const a = await encrypt("same input");
  const b = await encrypt("same input");
  assert.notEqual(a, b);
});

test("decrypt throws on tampered ciphertext", async () => {
  const ciphertext = await encrypt("tamper test");
  const tampered = ciphertext.slice(0, -4) + "abcd";
  await assert.rejects(() => decrypt(tampered));
});
