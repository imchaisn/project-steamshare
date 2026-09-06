import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getCodeForAccount, resolveDisplayCredentials } from "./index.ts";
import { isSupplierSite, totpCode } from "./types.ts";
import type { CodeResult } from "./types.ts";
import { clearCodeCache } from "./cache.ts";

// getCodeForAccount now serves a recently fetched code from cache instead of
// spending another redemption (see ./cache.ts). That is deliberate shared
// state between calls, so every test here starts from empty — otherwise one
// test's success silently satisfies the next test's fetcher and the assertion
// passes for the wrong reason.
beforeEach(() => clearCodeCache());

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

// ── The order mapping: our order id -> the other website's order id ─────────
//
// This is the connection Chaison specified. All of these websites are ours;
// the same Steam account is known to another of our sites by a DIFFERENT order
// id, and the username is identical on both sides. These tests pin that the
// per-order link is authoritative and that the account default only fills in
// where an order has no link of its own.

const mappedOrder = {
  supplierSite: "gamersfantasy.my",
  supplierOrderId: "THEIR-ORDER-99",
};

test("the order's own mapping decides which site is called and with what id", async () => {
  let seen: { orderId: string; username: string } | null = null;
  const r = await getCodeForAccount(
    totpAccount,
    {
      decryptFn: identity,
      supplierEnabled: true,
      fetchers: {
        "cyberspace.cyou": neverCalled,
        "gamersfantasy.my": async ({ orderId, username }) => {
          seen = { orderId, username };
          return { ok: true, code: "BCDFG" };
        },
      },
    },
    mappedOrder,
  );
  assert.deepEqual(r, { ok: true, code: "BCDFG" });
  // The username is the account's own — it is the same on both websites, so
  // only the order id has to be carried across.
  assert.deepEqual(seen, {
    orderId: "THEIR-ORDER-99",
    username: totpAccount.username,
  });
});

test("a mapped order overrides the account default, rather than merging with it", async () => {
  // The account points at cyberspace; this specific order points at
  // gamersfantasy. The explicit per-order link must win outright — silently
  // preferring the account's site while using the order's id would call the
  // wrong website with the wrong id.
  let calledSite: string | null = null;
  await getCodeForAccount(
    supplierAccount, // supplier_site: cyberspace.cyou, order: TEST-ORDER
    {
      decryptFn: identity,
      supplierEnabled: true,
      fetchers: {
        "cyberspace.cyou": async () => {
          calledSite = "cyberspace.cyou";
          return { ok: true, code: "BCDFG" };
        },
        "gamersfantasy.my": async ({ orderId }) => {
          calledSite = `gamersfantasy.my:${orderId}`;
          return { ok: true, code: "BCDFG" };
        },
      },
    },
    mappedOrder,
  );
  assert.equal(calledSite, "gamersfantasy.my:THEIR-ORDER-99");
});

test("an unmapped order falls back to the account's own default", async () => {
  // The automated Shopee pipeline inserts orders with no human in the loop, so
  // they arrive unmapped. Without this fallback they would serve nothing.
  let seenOrderId: string | null = null;
  await getCodeForAccount(
    supplierAccount,
    {
      decryptFn: identity,
      supplierEnabled: true,
      fetchers: {
        "cyberspace.cyou": async ({ orderId }) => {
          seenOrderId = orderId;
          return { ok: true, code: "BCDFG" };
        },
        "gamersfantasy.my": neverCalled,
      },
    },
    { supplierSite: null, supplierOrderId: null },
  );
  assert.equal(seenOrderId, "TEST-ORDER");
});

test("a blank or whitespace-only mapping is not treated as a mapping", async () => {
  // An empty string is not a link. It must fall through to the account rather
  // than becoming a supplier call with an empty order id.
  const r = await getCodeForAccount(
    totpAccount,
    { decryptFn: identity, supplierEnabled: true },
    { supplierSite: "  ", supplierOrderId: "   " },
  );
  assert.equal(r.ok, true, "should have fallen back to the account's own seed");
});

test("a mapped order still respects the kill switch", async () => {
  const r = await getCodeForAccount(
    totpAccount,
    { decryptFn: identity, supplierEnabled: false },
    mappedOrder,
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("a mapping naming a website we have no adapter for is supplier_error", async () => {
  const r = await getCodeForAccount(
    totpAccount,
    { decryptFn: identity, supplierEnabled: true },
    { supplierSite: "not-ours.example", supplierOrderId: "X1" },
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("a half-filled order mapping NEVER merges with the account's", async () => {
  // REGRESSION. Before this was fixed, an order naming one website with no
  // order id was completed from the ACCOUNT's order id — calling one site with
  // another site's id, silently, on the money path. A half-filled mapping is
  // broken configuration and must fail closed, not be quietly finished off.
  for (const partial of [
    { supplierSite: "gamersfantasy.my", supplierOrderId: null },
    { supplierSite: null, supplierOrderId: "ORPHAN-ORDER" },
  ]) {
    const r = await getCodeForAccount(
      supplierAccount, // cyberspace.cyou / TEST-ORDER
      {
        decryptFn: identity,
        supplierEnabled: true,
        fetchers: {
          "cyberspace.cyou": neverCalled,
          "gamersfantasy.my": neverCalled,
        },
      },
      partial,
    );
    assert.deepEqual(
      r,
      { ok: false, reason: "supplier_error" },
      `${JSON.stringify(partial)} must not reach any website`,
    );
  }
});

// ── resolveDisplayCredentials: the credentials-phase resolver ──────────────
//
// Closes the gap where a buyer could be SHOWN one pooled account (from the
// stored steam_accounts row) but have the code fetch target a DIFFERENT one,
// because gamersfantasy.my hands out a different account from its pool on
// different calls. null means "trust the stored row" — the caller's existing
// fallback path, exercised by app/api/lookup/route.ts.

const poolResolver = async () => ({ username: "pool-current", password: "pool-pass" });
const neverResolve = async (): Promise<null> => {
  throw new Error("this resolver must not be called");
};

test("a TOTP account resolves to null — the stored row is trusted as-is", async () => {
  const r = await resolveDisplayCredentials(totpAccount, null, {
    supplierEnabled: true,
    resolvers: { "gamersfantasy.my": neverResolve },
  });
  assert.equal(r, null);
});

test("a supplier account with no resolver for its site resolves to null", async () => {
  // cyberspace.cyou deliberately has none — see CREDENTIAL_RESOLVERS.
  const r = await resolveDisplayCredentials(supplierAccount, null, {
    supplierEnabled: true,
    resolvers: {},
  });
  assert.equal(r, null);
});

test("a supplier account whose site HAS a resolver returns the freshly resolved account", async () => {
  const r = await resolveDisplayCredentials(
    { ...supplierAccount, supplier_site: "gamersfantasy.my" },
    null,
    { supplierEnabled: true, resolvers: { "gamersfantasy.my": poolResolver } },
  );
  assert.deepEqual(r, { username: "pool-current", password: "pool-pass" });
});

test("the kill switch disables resolution the same way it disables the code fetch", async () => {
  const r = await resolveDisplayCredentials(
    { ...supplierAccount, supplier_site: "gamersfantasy.my" },
    null,
    { supplierEnabled: false, resolvers: { "gamersfantasy.my": poolResolver } },
  );
  assert.equal(r, null);
});

test("an order mapping picks the resolver the same way it picks the fetcher", async () => {
  // account defaults to cyberspace.cyou (no resolver); this order maps to
  // gamersfantasy.my (has one). The mapping must win for resolution exactly
  // as it wins for the code fetch — resolveSupplierTarget is shared code.
  const r = await resolveDisplayCredentials(supplierAccount, mappedOrder, {
    supplierEnabled: true,
    resolvers: { "gamersfantasy.my": poolResolver },
  });
  assert.deepEqual(r, { username: "pool-current", password: "pool-pass" });
});

test("a resolver that throws is treated as null, never a 500", async () => {
  const r = await resolveDisplayCredentials(
    { ...supplierAccount, supplier_site: "gamersfantasy.my" },
    null,
    {
      supplierEnabled: true,
      resolvers: {
        "gamersfantasy.my": async () => {
          throw new Error("timeout");
        },
      },
    },
  );
  assert.equal(r, null);
});
