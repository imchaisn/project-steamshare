import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cacheTtlMs,
  clearCodeCache,
  getCachedCode,
  invalidateCachedCode,
  setCachedCode,
} from "./cache.ts";
import { getCodeForAccount } from "./index.ts";
import type { CodeResult } from "./types.ts";

const SITE = "cyberspace.cyou";
const USER = "demo-account";

test("a stored code is returned again within the TTL", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode(SITE, "ORD-1", USER, "BCDFG", t0);
  assert.equal(getCachedCode(SITE, "ORD-1", USER, t0 + 30_000), "BCDFG");
});

test("a stored code is gone once the TTL has passed", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode(SITE, "ORD-1", USER, "BCDFG", t0);
  assert.equal(getCachedCode(SITE, "ORD-1", USER, t0 + cacheTtlMs()), null);
});

test("orders and sites do not share a cache entry", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode(SITE, "ORD-1", USER, "BCDFG", t0);
  assert.equal(getCachedCode(SITE, "ORD-2", USER, t0), null);
  assert.equal(getCachedCode("gamersfantasy.my", "ORD-1", USER, t0), null);
});

test("two accounts on the SAME pooled order never share a cache entry", () => {
  // The failure this prevents: gamersfantasy.my backs one order id with a pool
  // of distinct Steam accounts. Keyed on (site, orderId) alone, buyer B pinned
  // to account #2 would be handed buyer A's code for account #1 — a code that
  // cannot work, served with full confidence, on the money path.
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine1", "BCDFG", t0);

  assert.equal(
    getCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine1", t0),
    "BCDFG",
  );
  assert.equal(
    getCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine3", t0),
    null,
    "a different pool member must NOT receive this account's code",
  );
});

test("invalidating one pool member leaves the others' codes alone", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine1", "BCDFG", t0);
  setCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine3", "H9DXY", t0);

  invalidateCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine1");

  assert.equal(
    getCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine1", t0),
    null,
  );
  assert.equal(
    getCachedCode("gamersfantasy.my", "POOL-ORDER", "evilfantasynine3", t0),
    "H9DXY",
  );
});

test("an order id is matched regardless of surrounding whitespace", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode(SITE, " ORD-1 ", USER, "BCDFG", t0);
  assert.equal(getCachedCode(SITE, "ORD-1", USER, t0), "BCDFG");
});

test("invalidate forces the next request back to the site", () => {
  clearCodeCache();
  const t0 = 1_000_000;
  setCachedCode(SITE, "ORD-1", USER, "BCDFG", t0);
  invalidateCachedCode(SITE, "ORD-1", USER);
  assert.equal(getCachedCode(SITE, "ORD-1", USER, t0), null);
});

// ── The behaviour that actually protects the quota ──

const supplierAccount = {
  username: "demo-account",
  code_source: "supplier",
  supplier_site: SITE,
  supplier_order_id: "QUOTA-ORDER",
  shared_secret_enc: null,
};

test("repeat presses cost ONE redemption, not one each", async () => {
  // This is the whole point. Six development fetches exhausted a real order on
  // 2026-09-06; with this in place those same six presses cost one.
  clearCodeCache();
  let fetches = 0;
  const fetchers = {
    "cyberspace.cyou": async (): Promise<CodeResult> => {
      fetches++;
      return { ok: true, code: "BCDFG" };
    },
    "gamersfantasy.my": async (): Promise<CodeResult> => {
      throw new Error("wrong site");
    },
  };

  for (let i = 0; i < 6; i++) {
    const r = await getCodeForAccount(
      supplierAccount,
      { decryptFn: async (x) => x, supplierEnabled: true, fetchers },
      null,
    );
    assert.deepEqual(r, { ok: true, code: "BCDFG" });
  }

  assert.equal(fetches, 1, `six presses made ${fetches} requests to the site`);
});

test("a not-ready result is NEVER cached", async () => {
  // The buyer's next press is exactly when their state changes — they have
  // just logged into Steam. Serving them a stale "not ready" would strand
  // them behind a cache with no way through.
  clearCodeCache();
  let fetches = 0;
  const fetchers = {
    "cyberspace.cyou": async (): Promise<CodeResult> => {
      fetches++;
      return fetches === 1
        ? { ok: false, reason: "not_ready" as const }
        : { ok: true, code: "BCDFG" };
    },
    "gamersfantasy.my": async (): Promise<CodeResult> => {
      throw new Error("wrong site");
    },
  };
  const deps = { decryptFn: async (x: string) => x, supplierEnabled: true, fetchers };

  const first = await getCodeForAccount(supplierAccount, deps, null);
  assert.deepEqual(first, { ok: false, reason: "not_ready" });

  // The buyer logs into Steam, then presses again — this MUST reach the site.
  const second = await getCodeForAccount(supplierAccount, deps, null);
  assert.deepEqual(second, { ok: true, code: "BCDFG" });
  assert.equal(fetches, 2);
});

test("setting SUPPLIER_CODE_CACHE_MS to 0 disables caching entirely", () => {
  clearCodeCache();
  const prev = process.env.SUPPLIER_CODE_CACHE_MS;
  process.env.SUPPLIER_CODE_CACHE_MS = "0";
  try {
    setCachedCode(SITE, "ORD-1", USER, "BCDFG", 1_000_000);
    assert.equal(getCachedCode(SITE, "ORD-1", USER, 1_000_000), null);
  } finally {
    if (prev === undefined) delete process.env.SUPPLIER_CODE_CACHE_MS;
    else process.env.SUPPLIER_CODE_CACHE_MS = prev;
  }
});

// ── forceRefresh: "give me the NEWEST code" ──

test("forceRefresh bypasses the cache and spends a redemption", async () => {
  // The buyer has logged into Steam again, so a newer code now exists and the
  // held value is genuinely stale — not merely repeated.
  clearCodeCache();
  let fetches = 0;
  const fetchers = {
    "cyberspace.cyou": async (): Promise<CodeResult> => {
      fetches++;
      return { ok: true, code: fetches === 1 ? "BCDFG" : "H9DXY" };
    },
    "gamersfantasy.my": async (): Promise<CodeResult> => {
      throw new Error("wrong site");
    },
  };
  const base = { decryptFn: async (x: string) => x, supplierEnabled: true, fetchers };

  const first = await getCodeForAccount(supplierAccount, base, null);
  assert.deepEqual(first, { ok: true, code: "BCDFG" });

  // An ordinary repeat press is free and returns the same value.
  const repeat = await getCodeForAccount(supplierAccount, base, null);
  assert.deepEqual(repeat, { ok: true, code: "BCDFG" });
  assert.equal(fetches, 1);

  // Asking for the newest one goes to the site.
  const refreshed = await getCodeForAccount(
    supplierAccount,
    { ...base, forceRefresh: true },
    null,
  );
  assert.deepEqual(refreshed, { ok: true, code: "H9DXY" });
  assert.equal(fetches, 2);
});

test("a failed refresh does not leave the old code to be served again", async () => {
  // The buyer asked for the newest code, so the held one is stale by
  // definition. If the refresh fails, serving the stale value back would be
  // worse than failing honestly.
  clearCodeCache();
  let fetches = 0;
  const fetchers = {
    "cyberspace.cyou": async (): Promise<CodeResult> => {
      fetches++;
      return fetches === 1
        ? { ok: true, code: "BCDFG" }
        : { ok: false, reason: "not_ready" as const };
    },
    "gamersfantasy.my": async (): Promise<CodeResult> => {
      throw new Error("wrong site");
    },
  };
  const base = { decryptFn: async (x: string) => x, supplierEnabled: true, fetchers };

  await getCodeForAccount(supplierAccount, base, null);
  const refreshed = await getCodeForAccount(
    supplierAccount,
    { ...base, forceRefresh: true },
    null,
  );
  assert.deepEqual(refreshed, { ok: false, reason: "not_ready" });

  // And the stale code must be gone, not resurrected on the next press.
  const after = await getCodeForAccount(supplierAccount, base, null);
  assert.equal(after.ok, false, "the invalidated code was served again");
});
