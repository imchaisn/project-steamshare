import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintCode } from "./fingerprint.ts";

test("the same code always fingerprints identically", async () => {
  assert.equal(await fingerprintCode("BCDFG"), await fingerprintCode("BCDFG"));
});

test("different codes fingerprint differently — this is what detects a change", async () => {
  assert.notEqual(await fingerprintCode("BCDFG"), await fingerprintCode("H9DXY"));
});

test("case and surrounding whitespace do not count as a change", async () => {
  // Steam codes are shown uppercase; a difference in presentation must not be
  // reported to the operator as "the code changed".
  assert.equal(await fingerprintCode("BCDFG"), await fingerprintCode(" bcdfg "));
});

test("the fingerprint is short and non-obvious", async () => {
  const fp = await fingerprintCode("BCDFG");
  assert.equal(fp.length, 12);
  assert.match(fp, /^[0-9a-f]{12}$/);
  // Must not contain the code itself in any form.
  assert.doesNotMatch(fp.toUpperCase(), /BCDFG/);
});
