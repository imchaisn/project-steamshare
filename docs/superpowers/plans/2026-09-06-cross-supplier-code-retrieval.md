# Cross-supplier Code Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a GameShare buyer pull a Steam Guard code for an account whose code lives on another of our own websites, using the same lookup form and the same username/password as every other order.

**Architecture:** A supplier account is just an account whose code comes from somewhere else. `steam_accounts` gains a `code_source` discriminator plus supplier site/order-id fields; a new `lib/code-source/` provider layer turns "give me a code for this account" into either a local TOTP (unchanged) or an HTTP call to the supplier. `app/api/lookup/route.ts` changes at exactly one call site. Nothing upstream — allocation, fulfilment, delivery, orders — is touched.

**Tech Stack:** Next.js 16.2.7 App Router, TypeScript, Supabase Postgres, `node:test` with `--experimental-strip-types`, AES-256-GCM via `lib/encryption.ts`.

**Spec:** `docs/superpowers/specs/2026-09-06-cross-supplier-code-retrieval-design.md`

## Global Constraints

- **THE REPO IS PUBLIC.** No real credential in any tracked file, docs included. `local/` is gitignored and is the only place real order ids, usernames or passwords may be written.
- Next.js is **16.2.7** and has breaking changes against training data. Read `node_modules/next/dist/docs/` before using any framework API. (`AGENTS.md` outranks all other guidance on this.)
- Tests run with `node --test --experimental-strip-types <file>`. There is no `test` script in `package.json`. Import sibling modules with an explicit `.ts` extension, matching `lib/totp.test.ts`.
- Migration `0009` is written but **NOT applied**. `0011` must not depend on it.
- Every migration file on disk must also appear in the `MIGRATIONS` array in `scripts/run-migrations.mjs:52`.
- `code_source` vocabulary is exactly `'totp' | 'supplier'`. `supplier_site` vocabulary is exactly `'cyberspace.cyou' | 'gamersfantasy.my'`.
- `CodeResult` failure reasons are exactly `'not_ready' | 'expired' | 'supplier_error'`.
- All three failure reasons record rate-limit outcome **`unavailable`**, never `failure`. This is a hard requirement, not a preference — see Task 5.
- Supplier HTTP timeout is **5000ms**.
- Kill switch env var is **`SUPPLIER_CODE_SOURCE`**; absent or `'false'` disables supplier fetching.

---

### Task 1: Migration 0011 — the code_source discriminator

**Files:**
- Create: `supabase/migrations/0011_steam_accounts_code_source.sql`
- Modify: `scripts/run-migrations.mjs:52-62` (add to `MIGRATIONS`)

**Interfaces:**
- Consumes: nothing.
- Produces: `steam_accounts.code_source` (`text not null default 'totp'`), `steam_accounts.supplier_site` (`text null`), `steam_accounts.supplier_order_id` (`text null`), `shared_secret_enc` becomes nullable, CHECK constraint `steam_accounts_code_source_shape`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- 0011_steam_accounts_code_source.sql
-- Project Steamshare — second code source: supplier-hosted Guard codes
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- INDEPENDENT OF 0009. 0009 (orders follow-up columns) is written but not
-- applied; this migration touches a different table and must not wait on it.
--
-- Until now every sellable account was one we hold the Steam Guard seed for,
-- so app/api/lookup/route.ts could always mint a code offline from
-- shared_secret_enc. Accounts held on another of our sites have no seed
-- we own — their code lives on the supplier's own portal and must be fetched
-- over HTTP. 0001 declared shared_secret_enc NOT NULL, so such an account
-- could not previously be represented in this database at all.

alter table steam_accounts
  add column if not exists code_source       text not null default 'totp',
  add column if not exists supplier_site     text,
  add column if not exists supplier_order_id text;

-- Every one of the 7 existing accounts is a TOTP account, and the default
-- above already says so. No backfill, and no window in which a live account
-- is misrouted to a supplier it has no configuration for.

alter table steam_accounts alter column shared_secret_enc drop not null;

-- The CHECK is the point of this migration, not decoration. Dropping the NOT
-- NULL above opens a hole: a row could be inserted with code_source 'totp'
-- and no seed, pass every check in the lookup route (order verified, username
-- matched, status active) and only then throw at code generation — failing at
-- the last possible moment, for a buyer who already paid. Same class of guard
-- as 0008's dependency abort: refuse the bad state at write time.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'steam_accounts_code_source_shape'
      and conrelid = 'public.steam_accounts'::regclass
  ) then
    alter table steam_accounts add constraint steam_accounts_code_source_shape check (
      (code_source = 'totp'     and shared_secret_enc is not null)
      or
      (code_source = 'supplier' and supplier_site is not null
                                and supplier_order_id is not null)
    );
  end if;
end $$;

-- Deliberately NO check constraint pinning the code_source or supplier_site
-- vocabulary. 0008 learned this the hard way: pinning a guessed enum in SQL
-- makes production inserts fail on a value that is merely spelled
-- differently. The vocabulary is enforced in TypeScript
-- (lib/code-source/types.ts), where it can be changed in the same commit as
-- the code that uses it.

-- Supports the admin panel's "show me every supplier account and its order
-- id" read. Partial, because supplier accounts are the small minority and the
-- TOTP majority must not bloat the index.
create index if not exists steam_accounts_supplier_idx
  on steam_accounts (supplier_site, supplier_order_id)
  where code_source = 'supplier';
```

- [ ] **Step 2: Register it in the migration runner**

In `scripts/run-migrations.mjs`, add after the `0009` line inside `MIGRATIONS`:

```js
  "supabase/migrations/0011_steam_accounts_code_source.sql",
```

- [ ] **Step 3: Verify parity**

Run: `ls supabase/migrations/*.sql | wc -l` and `grep -c "supabase/migrations/" scripts/run-migrations.mjs`
Expected: both report 10.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0011_steam_accounts_code_source.sql scripts/run-migrations.mjs
git commit -m "Add migration 0011: code_source discriminator on steam_accounts"
```

---

### Task 2: The provider contract and the TOTP adapter

**Files:**
- Create: `lib/code-source/types.ts`
- Create: `lib/code-source/totp-source.ts`
- Create: `lib/code-source/types.test.ts`

**Interfaces:**
- Consumes: `generateSteamGuardCode` from `lib/totp.ts`.
- Produces:
  - `type CodeSource = 'totp' | 'supplier'`
  - `type SupplierSite = 'cyberspace.cyou' | 'gamersfantasy.my'`
  - `type CodeFailureReason = 'not_ready' | 'expired' | 'supplier_error'`
  - `type CodeResult = { ok: true; code: string } | { ok: false; reason: CodeFailureReason }`
  - `interface CodeSourceAccount { username: string; code_source: string | null; supplier_site: string | null; supplier_order_id: string | null; shared_secret_enc: string | null }`
  - `type SupplierFetch = (args: { orderId: string; username: string; signal: AbortSignal }) => Promise<CodeResult>`
  - `const SUPPLIER_TIMEOUT_MS = 5000`
  - `function isSupplierSite(v: string | null): v is SupplierSite`
  - `async function totpCode(account: CodeSourceAccount, decryptFn): Promise<CodeResult>`

- [ ] **Step 1: Write the failing test**

Create `lib/code-source/types.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSupplierSite, totpCode } from "./types.ts";

// 20 bytes of 0x01, base64 — the same vector lib/totp.test.ts uses.
const TEST_SECRET = "AQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const identity = async (s: string) => s;

test("isSupplierSite accepts only the two known sites", () => {
  assert.equal(isSupplierSite("cyberspace.cyou"), true);
  assert.equal(isSupplierSite("gamersfantasy.my"), true);
  assert.equal(isSupplierSite("evil.example.com"), false);
  assert.equal(isSupplierSite(null), false);
});

test("totpCode returns a 5-character code for an account holding a seed", async () => {
  const result = await totpCode(
    {
      username: "ssp266",
      code_source: "totp",
      supplier_site: null,
      supplier_order_id: null,
      shared_secret_enc: TEST_SECRET,
    },
    identity,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.code.length, 5);
});

test("totpCode reports supplier_error rather than throwing when the seed is missing", async () => {
  const result = await totpCode(
    {
      username: "broken",
      code_source: "totp",
      supplier_site: null,
      supplier_order_id: null,
      shared_secret_enc: null,
    },
    identity,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "supplier_error");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/code-source/types.test.ts`
Expected: FAIL — cannot find module `./types.ts`.

- [ ] **Step 3: Write `lib/code-source/types.ts`**

```ts
/**
 * The contract every code source satisfies.
 *
 * Until 2026-09-06 there was exactly one way to obtain a Steam Guard code:
 * mint it locally from a shared_secret we own. Accounts bought from
 * another of our own websites have no seed here — their code lives on that
 * supplier's portal. This module is the seam between those two worlds, so
 * that app/api/lookup/route.ts contains one branch rather than two flows.
 */
import { generateSteamGuardCode } from "../totp.ts";

export type CodeSource = "totp" | "supplier";
export type SupplierSite = "cyberspace.cyou" | "gamersfantasy.my";

/**
 * Why a code could not be produced.
 *   not_ready      — the supplier has no code yet because nobody has attempted
 *                    the Steam login. Correct behaviour, not a fault: the
 *                    login attempt is what makes Steam email the code.
 *   expired        — the supplier had a code and it timed out.
 *   supplier_error — anything else: network, timeout, unparseable body,
 *                    misconfigured account.
 */
export type CodeFailureReason = "not_ready" | "expired" | "supplier_error";

export type CodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: CodeFailureReason };

/** The columns of steam_accounts this layer needs. */
export interface CodeSourceAccount {
  username: string;
  code_source: string | null;
  supplier_site: string | null;
  supplier_order_id: string | null;
  shared_secret_enc: string | null;
}

export type SupplierFetch = (args: {
  orderId: string;
  username: string;
  signal: AbortSignal;
}) => Promise<CodeResult>;

/**
 * A supplier portal gets 5 seconds. Vercel functions are billed on wall time
 * and a buyer is waiting, so a hanging third party must not hold the request
 * open — it must fail fast into supplier_error.
 */
export const SUPPLIER_TIMEOUT_MS = 5000;

const SUPPLIER_SITES: readonly string[] = ["cyberspace.cyou", "gamersfantasy.my"];

export function isSupplierSite(value: string | null): value is SupplierSite {
  return value !== null && SUPPLIER_SITES.includes(value);
}

/**
 * The original path, unchanged in behaviour: mint the code offline from the
 * account's own seed. Never touches the network, so it cannot be degraded by
 * any supplier outage.
 *
 * `decryptFn` is injected so tests can run without ACCOUNTS_ENCRYPTION_KEY.
 */
export async function totpCode(
  account: CodeSourceAccount,
  decryptFn: (ciphertext: string) => Promise<string>,
): Promise<CodeResult> {
  if (!account.shared_secret_enc) {
    // Migration 0011's CHECK constraint makes this unreachable through normal
    // writes. Handled rather than thrown because an unhandled throw here is a
    // 500 for a buyer who already paid, and a 500 tells them nothing.
    return { ok: false, reason: "supplier_error" };
  }
  const sharedSecret = await decryptFn(account.shared_secret_enc);
  return { ok: true, code: await generateSteamGuardCode(sharedSecret) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/code-source/types.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/code-source/types.ts lib/code-source/types.test.ts
git commit -m "Add the code-source contract and the TOTP adapter"
```

---

### Task 3: Supplier adapters

**Files:**
- Create: `lib/code-source/cyberspace.ts`
- Create: `lib/code-source/gamersfantasy.ts`
- Create: `lib/code-source/adapters.test.ts`

**Interfaces:**
- Consumes: `CodeResult`, `SupplierFetch` from `./types.ts`.
- Produces: `cyberspaceFetch: SupplierFetch`, `gamersfantasyFetch: SupplierFetch`, and from each module a pure `classify*(status: number, body: string): CodeResult` used by the tests.

**Blocking input:** the observed contracts in `local/websites/cyberspace.cyou-contract.md` and `local/websites/gamersfantasy.my-contract.md`. Each adapter's `classify` function must be written against the **verbatim response bodies recorded there**, never against a guess. Where a contract file records a case as unresolved, that case falls through to `supplier_error` and gets a comment saying so.

- [ ] **Step 1: Write the failing classification tests**

The test file asserts the mapping table from each contract's `## Outcome mapping` section. Structure — fill the fixture strings with the **verbatim bodies from the contract files**:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCyberspace } from "./cyberspace.ts";
import { classifyGamersfantasy } from "./gamersfantasy.ts";

test("cyberspace: a successful body yields the code", () => {
  const r = classifyCyberspace(200, /* verbatim success body */ "");
  assert.equal(r.ok, true);
});

test("cyberspace: the CODE TIMEOUT body is expired, not a generic error", () => {
  const r = classifyCyberspace(404, /* verbatim timeout body */ "");
  assert.deepEqual(r, { ok: false, reason: "expired" });
});

test("cyberspace: no-login-attempted-yet is not_ready", () => {
  const r = classifyCyberspace(404, /* verbatim not-ready body */ "");
  assert.deepEqual(r, { ok: false, reason: "not_ready" });
});

test("cyberspace: an unrecognised body is supplier_error, never a crash", () => {
  assert.deepEqual(classifyCyberspace(500, "<html>502 Bad Gateway</html>"), {
    ok: false,
    reason: "supplier_error",
  });
  assert.deepEqual(classifyCyberspace(200, "}{ not json"), {
    ok: false,
    reason: "supplier_error",
  });
});

test("gamersfantasy: a successful body yields the code", () => {
  const r = classifyGamersfantasy(200, /* verbatim success body */ "");
  assert.equal(r.ok, true);
});

test("gamersfantasy: no-code-yet is not_ready", () => {
  const r = classifyGamersfantasy(200, /* verbatim not-ready body */ "");
  assert.deepEqual(r, { ok: false, reason: "not_ready" });
});

test("gamersfantasy: an unrecognised body is supplier_error, never a crash", () => {
  assert.deepEqual(classifyGamersfantasy(200, "}{ not json"), {
    ok: false,
    reason: "supplier_error",
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --experimental-strip-types lib/code-source/adapters.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both adapters**

Each module exports a pure `classify*(status, body): CodeResult` — where every branch is justified by a quoted line from the contract file — plus a `SupplierFetch` that performs the HTTP call (including cyberspace's CSRF/session handshake), passes `signal` to `fetch`, and hands the response to `classify`. Every adapter wraps its own body in `try/catch` returning `supplier_error`, so a thrown parse error can never reach the route.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test --experimental-strip-types lib/code-source/adapters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/code-source/cyberspace.ts lib/code-source/gamersfantasy.ts lib/code-source/adapters.test.ts
git commit -m "Add cyberspace and gamersfantasy code adapters"
```

---

### Task 4: The router — `getCodeForAccount`

**Files:**
- Create: `lib/code-source/index.ts`
- Create: `lib/code-source/index.test.ts`

**Interfaces:**
- Consumes: everything from `./types.ts`, `./cyberspace.ts`, `./gamersfantasy.ts`, `decrypt` from `../encryption.ts`.
- Produces: `async function getCodeForAccount(account: CodeSourceAccount, deps?: Partial<CodeSourceDeps>): Promise<CodeResult>` and `interface CodeSourceDeps { decryptFn; fetchers: Record<SupplierSite, SupplierFetch>; supplierEnabled: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCodeForAccount } from "./index.ts";
import type { CodeResult } from "./types.ts";

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

test("a legacy row with a null code_source is treated as totp", async () => {
  const r = await getCodeForAccount(
    { ...totpAccount, code_source: null },
    { decryptFn: identity, supplierEnabled: true },
  );
  assert.equal(r.ok, true);
});

test("a supplier account is routed to its site's fetcher", async () => {
  const r = await getCodeForAccount(supplierAccount, {
    decryptFn: identity,
    supplierEnabled: true,
    fetchers: {
      "cyberspace.cyou": okFetch,
      "gamersfantasy.my": async () => ({ ok: false, reason: "supplier_error" }),
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
  assert.equal((await getCodeForAccount(totpAccount, off)).ok, true);
});

test("an unknown supplier site is supplier_error, not a crash", async () => {
  const r = await getCodeForAccount(
    { ...supplierAccount, supplier_site: "evil.example.com" },
    { decryptFn: identity, supplierEnabled: true },
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
});

test("a fetcher that throws becomes supplier_error", async () => {
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --experimental-strip-types lib/code-source/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/code-source/index.ts`**

Routes on `account.code_source`, defaulting anything that is not exactly `'supplier'` to the TOTP path (so a legacy `null` row is safe). Validates `supplier_site` through `isSupplierSite`. Applies `AbortSignal.timeout(SUPPLIER_TIMEOUT_MS)`. Wraps the fetcher call in `try/catch` → `supplier_error`. Reads `process.env.SUPPLIER_CODE_SOURCE === "true"` for the default `supplierEnabled`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test --experimental-strip-types lib/code-source/index.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/code-source/index.ts lib/code-source/index.test.ts
git commit -m "Add getCodeForAccount router with kill switch and timeout"
```

---

### Task 5: Wire the lookup route

**Files:**
- Modify: `app/api/lookup/route.ts`
- Create: `lib/code-source/outcome.ts`
- Create: `lib/code-source/outcome.test.ts`

**Interfaces:**
- Consumes: `CodeFailureReason` from `./types.ts`, `LookupOutcome` from `../rate-limit.ts`.
- Produces: `function failureResponseFor(reason: CodeFailureReason): { outcome: LookupOutcome; status: number; error: string }`.

**Why this task is separate:** the outcome mapping is the one place a plausible-looking implementation silently locks paying buyers out. It gets its own module and its own regression test.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { failureResponseFor } from "./outcome.ts";
import { HEAVY_OUTCOMES } from "../rate-limit.ts";

// REGRESSION GUARD. MAX_WEIGHTED_ATTEMPTS_PER_ORDER is 20 and
// FAILED_ATTEMPT_WEIGHT is 3. If any of these reasons were recorded as
// "failure", a buyer pressing retry while waiting for Steam to prompt them
// would exhaust their own 15-minute budget after SIX presses — punished for
// doing exactly what our own error message told them to do.
test("no supplier failure is ever recorded at the heavy weight", () => {
  for (const reason of ["not_ready", "expired", "supplier_error"] as const) {
    const { outcome } = failureResponseFor(reason);
    assert.ok(
      !HEAVY_OUTCOMES.includes(outcome),
      `${reason} maps to ${outcome}, which is rate-limited at 3x`,
    );
    assert.equal(outcome, "unavailable");
  }
});

test("not_ready tells the buyer to log into Steam first", () => {
  const { status, error } = failureResponseFor("not_ready");
  assert.equal(status, 409);
  assert.match(error, /log in to steam/i);
});

test("expired tells the buyer to retry the login", () => {
  assert.match(failureResponseFor("expired").error, /expired/i);
});

test("supplier_error stays generic and never names the supplier", () => {
  const { error } = failureResponseFor("supplier_error");
  assert.doesNotMatch(error, /cyberspace|gamersfantasy/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --experimental-strip-types lib/code-source/outcome.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/code-source/outcome.ts`**

```ts
import type { LookupOutcome } from "../rate-limit.ts";
import type { CodeFailureReason } from "./types.ts";

/**
 * Map a code-source failure to its HTTP response and its rate-limit outcome.
 *
 * Every reason here records `unavailable`, whose docstring in lib/rate-limit.ts
 * already reads "order verified, but ... A real buyer hitting an ops problem,
 * NOT an attacker." That is exactly this situation: the caller has already
 * proven entitlement — the order matched, the username matched, the account is
 * active — before any supplier is contacted. There is nothing left to
 * enumerate, so a specific message leaks nothing, and the heavy `failure`
 * weight would punish a paying customer for following our instructions.
 */
export function failureResponseFor(reason: CodeFailureReason): {
  outcome: LookupOutcome;
  status: number;
  error: string;
} {
  switch (reason) {
    case "not_ready":
      return {
        outcome: "unavailable",
        status: 409,
        error:
          "Log in to Steam first. When Steam asks for your 5-character code, come back and press Get Code.",
      };
    case "expired":
      return {
        outcome: "unavailable",
        status: 409,
        error:
          "That code expired. Attempt the Steam login again, then press Get Code.",
      };
    case "supplier_error":
      return {
        outcome: "unavailable",
        status: 503,
        error: "Code service temporarily unavailable, contact support",
      };
  }
}
```

- [ ] **Step 4: Modify the route**

In `app/api/lookup/route.ts`, replace the import of `generateSteamGuardCode` with `getCodeForAccount` from `@/lib/code-source` and `failureResponseFor` from `@/lib/code-source/outcome`. Extend the `steam_accounts` select to include `code_source, supplier_site, supplier_order_id`. Replace the parallel decrypt/generate block with: decrypt the password, call `getCodeForAccount(account)`, and on `!result.ok` return `failureResponseFor(result.reason)` through the existing `finish()` helper. The success branch, the `code_access_log` insert, and every check before this point stay byte-identical.

- [ ] **Step 5: Run all tests and typecheck**

Run: `node --test --experimental-strip-types lib/*.test.ts lib/code-source/*.test.ts` then `npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/lookup/route.ts lib/code-source/outcome.ts lib/code-source/outcome.test.ts
git commit -m "Route lookups through the code-source layer"
```

---

### Task 6: Admin API — supplier fields and password reveal

**Files:**
- Modify: `app/api/admin/accounts/route.ts`
- Create: `app/api/admin/accounts/reveal/route.ts`

**Interfaces:**
- Consumes: `encrypt`, `decrypt` from `@/lib/encryption`.
- Produces: `GET /api/admin/accounts` additionally returns `code_source`, `supplier_site`, `supplier_order_id`. `POST` accepts `codeSource`, `supplierSite`, `supplierOrderId`. `PATCH` additionally accepts `supplierSite` and `supplierOrderId`. `POST /api/admin/accounts/reveal` with `{ id }` returns `{ username, password, supplierSite, supplierOrderId }`.

**Why reveal is a separate POST route:** Chaison needs the password to key into a supplier portal by hand. Adding it to the list `GET` would put every plaintext password of the fleet into one response on every page load. A per-account, on-demand POST keeps the blast radius to the one account actually being worked on. Both are behind the same `proxy.ts` admin gate.

- [ ] **Step 1: Extend GET, POST and PATCH**

`GET` select becomes `id, username, status, recovery_email, created_at, code_source, supplier_site, supplier_order_id`.

`POST` validates by shape, mirroring migration 0011's CHECK: `username` and `password` always required; `sharedSecret` required only when `codeSource !== 'supplier'`; `supplierSite` and `supplierOrderId` required when `codeSource === 'supplier'`, with `supplierSite` validated against `isSupplierSite`. Reject a mismatched shape with 400 and a message naming the missing field — the DB CHECK is the backstop, not the error message the operator should see.

`PATCH` keeps its existing status-only behaviour working (status alone is still a valid body) and additionally accepts `supplierOrderId` / `supplierSite` so an order id can be corrected without recreating the account.

- [ ] **Step 2: Add the reveal route**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decrypt } from "@/lib/encryption";

/**
 * Reveal one account's plaintext password on demand.
 *
 * POST rather than GET, and one account at a time, on purpose: the operator
 * needs this to key credentials into a supplier's portal by hand, and putting
 * passwords in the list GET would ship the whole fleet's plaintext on every
 * admin page load. Gated by proxy.ts like every other /api/admin route.
 */
export async function POST(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .select("username, password_enc, supplier_site, supplier_order_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({
    username: data.username,
    password: await decrypt(data.password_enc),
    supplierSite: data.supplier_site,
    supplierOrderId: data.supplier_order_id,
  });
}
```

- [ ] **Step 3: Confirm the route is behind the admin gate**

Run: `grep -n "admin" proxy.ts`
Expected: `/api/admin` is matched by the gate, so the new nested route inherits it. If the matcher is exact-path rather than prefix, extend it.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/accounts/route.ts app/api/admin/accounts/reveal/route.ts
git commit -m "Admin API: supplier fields and on-demand password reveal"
```

---

### Task 7: Admin UI

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: the Task 6 endpoints.
- Produces: no exports; UI only.

- [ ] **Step 1: Extend the `Account` interface and the new-account form state**

Add `code_source`, `supplier_site`, `supplier_order_id` to `interface Account`. Add `codeSource: "totp"`, `supplierSite: "cyberspace.cyou"`, `supplierOrderId: ""` to the `newAccount` state and to its reset object.

- [ ] **Step 2: Add the code-source selector and conditional fields**

A `<select>` bound to `newAccount.codeSource` with options `Own Steam Guard (TOTP)` / `Supplier website`. When `supplier`, render a `supplierSite` select (the two domains) and a `supplierOrderId` text input, and drop the `required` attribute from the shared-secret input; when `totp`, keep shared secret required and hide the supplier inputs.

- [ ] **Step 3: Add Source / Supplier order id columns and a Reveal control to the accounts table**

New columns render `a.code_source ?? "totp"`, `a.supplier_site ?? "—"`, `a.supplier_order_id ?? "—"`. A **Reveal** button per row POSTs `{ id }` to `/api/admin/accounts/reveal` and shows the returned username and password inline for that row only, with a **Hide** toggle. Store revealed values in a `Record<string, {username, password}>` keyed by account id so revealing one row never reveals another.

- [ ] **Step 4: Add inline edit for the supplier order id**

For rows where `code_source === "supplier"`, the order-id cell is an input that PATCHes `{ id, supplierOrderId }` on blur — so a rotated supplier order can be corrected in place.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/admin/page.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "Admin UI: code source, supplier order id, password reveal"
```

---

### Task 8: Seed script for supplier accounts

**Files:**
- Create: `scripts/seed-suppliers.mjs`

**Interfaces:**
- Consumes: `local/websites/*.md`, the PostgREST API with the service-role key (the DB password is known broken — see `CHECKPOINT.md` open item 1).
- Produces: idempotent upsert of supplier accounts keyed on `username`.

- [ ] **Step 1: Write the script**

Parses the markdown tables in `local/websites/<domain>.md` (skipping the README and any `*-contract.md`), maps each row to `{ username, password, supplier_site: <domain>, supplier_order_id, code_source: 'supplier' }`, encrypts the password with the same AES-256-GCM scheme as `lib/encryption.ts`, and upserts on `username`. Handles the Wukong block, where several usernames share one order id, by reading the order id from the section heading. Contains **no credentials of its own** — it only reads `local/`, exactly as `scripts/seed-fleet.mjs` does.

- [ ] **Step 2: Dry run**

Run: `node scripts/seed-suppliers.mjs --dry-run`
Expected: prints the row count and each username with its supplier site and order id, writing nothing.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-suppliers.mjs
git commit -m "Add supplier account seed script"
```

---

### Task 9: Verification and checkpoint

**Files:**
- Modify: `CHECKPOINT.md`
- Modify: `.env.local.example`

- [ ] **Step 1: Add the kill switch to `.env.local.example`**

```
# Enables fetching Guard codes from our other websites for accounts
# with code_source='supplier'. Absent or false = supplier accounts return
# "temporarily unavailable"; TOTP accounts are unaffected either way.
# Vercel bakes env vars into a deployment — changing this also needs a redeploy.
SUPPLIER_CODE_SOURCE=
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `node --test --experimental-strip-types lib/*.test.ts lib/code-source/*.test.ts && npx tsc --noEmit && npx next build`
Expected: all pass.

- [ ] **Step 3: Update `CHECKPOINT.md`**

Add a "Second code source" section under "What's built" recording: migration 0011 applied or not, the `SUPPLIER_CODE_SOURCE` switch and its redeploy caveat, and a `FACT-V` line for a real end-to-end supplier lookup. State plainly that the feature is **not proven live** until that `FACT-V` exists — per `TEAM.md` §7, a claim of "working" without one is a process kill.

- [ ] **Step 4: Commit**

```bash
git add CHECKPOINT.md .env.local.example
git commit -m "Record the second code source in CHECKPOINT"
```

---

## Self-Review

**Spec coverage:** §3.2 → Task 1. §3.3 → Tasks 2–4. §3.4 → Task 5. §3.5 → Task 5 (own module + regression test). §3.6 → Task 4 (timeout, kill switch) + Task 9 (env). §3.7 → Task 5 (`failureResponseFor` messages; `app/page.tsx` already renders `data.error`, so no change needed). §3.8 → Tasks 6–7. §3.9 → Task 8. §4 → tests inside each task.

**Placeholders:** Task 3's fixture bodies are intentionally left as `/* verbatim ... */` because they must be copied from the researcher contract files rather than invented — that is a hard input dependency, not an unspecified decision, and the task states exactly where the values come from. No other step defers a decision.

**Type consistency:** `CodeResult`, `CodeFailureReason`, `CodeSourceAccount`, `SupplierFetch`, `SUPPLIER_TIMEOUT_MS`, `isSupplierSite` are defined in Task 2 and used with identical names and shapes in Tasks 3, 4 and 5. `failureResponseFor` is defined in Task 5 and used only there. `getCodeForAccount` is defined in Task 4 and used in Task 5.
