import { test } from "node:test";
import assert from "node:assert/strict";
import { getCodeForAccount } from "./index.ts";
import { isSupplierSite, totpCode } from "./types.ts";
import type { CodeResult } from "./types.ts";

// 20 bytes of 0x01, base64 — the same vector lib/totp.test.ts uses.
const TEST_SECRET = "AQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const identity = async (s: string) => s;

const totpAccount = {
  username: "ssp266",
  code_source: "totp",
  supplier_site: null,
  supplier_order_id: null,
  shared_secret_enc: TEST_SECRET,
};

const supplierAccount = {
  username: "demo-account",
  code_source: "supplier",
  supplier_site: "cyberspace.cyou",
  supplier_order_id: "TEST-ORDER",
  shared_secret_enc: null,
};

const okFetch = async (): Promise<CodeResult> => ({ ok: true, code: "BCDFG" });
const neverCalled = async (): Promise<CodeResult> => {
  throw new Error("this fetcher must not be called");
};

test("isSupplierSite accepts only the two known sites", () => {
  assert.equal(isSupplierSite("cyberspace.cyou"), true);
  assert.equal(isSupplierSite("gamersfantasy.my"), true);
  assert.equal(isSupplierSite("evil.example.com"), false);
  assert.equal(isSupplierSite(null), false);
});

test("totpCode returns a 5-character code for an account holding a seed", async () => {
  const result = await totpCode(totpAccount, identity);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.code.length, 5);
});

test("totpCode reports supplier_error rather than throwing when the seed is missing", async () => {
  const result = await totpCode(
    { ...totpAccount, shared_secret_enc: null },
    identity,
  );
  assert.deepEqual(result, { ok: false, reason: "supplier_error" });
});

test("a legacy row with a null code_source is treated as totp", async () => {
  // Rows written before migration 0011 have no code_source. Defaulting them
  // to anything but totp would break every live account the moment the
  // column appeared.
  const r = await getCodeForAccount(
    { ...totpAccount, code_source: null },
    { decryptFn: identity, supplierEnabled: true },
  );
  assert.equal(r.ok, true);
});

test("a TOTP account never reaches a supplier fetcher", async () => {
  const r = await getCodeForAccount(totpAccount, {
    decryptFn: identity,
    supplierEnabled: true,
    fetchers: {
      "cyberspace.cyou": neverCalled,
      "gamersfantasy.my": neverCalled,
    },
  });
  assert.equal(r.ok, true);
});

test("a supplier account is routed to its own site's fetcher", async () => {
  const r = await getCodeForAccount(supplierAccount, {
    decryptFn: identity,
    supplierEnabled: true,
    fetchers: {
      "cyberspace.cyou": okFetch,
      "gamersfantasy.my": neverCalled,
    },
  });
  assert.deepEqual(r, { ok: true, code: "BCDFG" });
});

test("the kill switch disables supplier accounts but never TOTP accounts", async () => {
  const off = { decryptFn: identity, supplierEnabled: false };
  assert.deepEqual(await getCodeForAccount(supplierAccount, off), {
    ok: false,
    reason: "supplier_error",
  });
  // The property that makes this feature strictly additive: killing the
  // supplier path leaves the accounts serving buyers today untouched.
  assert.equal((await getCodeForAccount(totpAccount, off)).ok, true);
});

test("an unknown supplier site is supplier_error, not a crash", async () => {
  const r = await getCodeForAccount(
    { ...supplierAccount, supplier_site: "evil.example.com" },
    { decryptFn: identity, supplierEnabled: true },
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("a supplier account with no order id is supplier_error", async () => {
  const r = await getCodeForAccount(
    { ...supplierAccount, supplier_order_id: null },
    { decryptFn: identity, supplierEnabled: true },
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("a fetcher that throws becomes supplier_error, never a 500", async () => {
  const r = await getCodeForAccount(supplierAccount, {
    decryptFn: identity,
    supplierEnabled: true,
    fetchers: {
      "cyberspace.cyou": async () => {
        throw new Error("socket hang up");
      },
      "gamersfantasy.my": okFetch,
    },
  });
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("the supplier order id, not the buyer's order id, is sent to the portal", async () => {
  let seen: { orderId: string; username: string } | null = null;
  await getCodeForAccount(supplierAccount, {
    decryptFn: identity,
    supplierEnabled: true,
    fetchers: {
      "cyberspace.cyou": async ({ orderId, username }) => {
        seen = { orderId, username };
        return { ok: true, code: "BCDFG" };
      },
      "gamersfantasy.my": neverCalled,
    },
  });
  assert.deepEqual(seen, { orderId: "TEST-ORDER", username: "demo-account" });
});
