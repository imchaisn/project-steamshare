# Cross-supplier Steam Guard code retrieval — design

**Date:** 2026-09-06
**Status:** Approved by Chaison, 2026-09-06. Implementation in progress.
**Problem source:** `local/sharewebsite-problem.md` → "Cross-account code sharing between Shopee stores"

---

## 1. The problem

GameShare sells shared Steam accounts on Shopee. Every buyer lookup today resolves down
one path in `app/api/lookup/route.ts`:

```
orderId + username
  -> orders -> account_games -> steam_accounts
  -> decrypt(shared_secret_enc) -> generateSteamGuardCode() -> 5-char code
```

The load-bearing property is that **we own the Steam Guard seed**. That gives the system
four things it silently depends on: codes generate offline, codes are infinite, codes
never 404, and latency is microseconds — so the money path contains no timeout logic
anywhere.

Some accounts we sell live on **another of our own websites**, whose portal holds the Guard
code instead of this one. Those accounts violate all four properties. Their code:

- exists **only after a real Steam login attempt** (the attempt is what makes Steam email
  the code to the supplier's registered address)
- **expires** (`CODE TIMEOUT`, observed on the DELTARUNE order 2026-09-06)
- requires an **outbound HTTP call** to undocumented endpoints reverse-engineered from a button
- can fail for reasons entirely outside our control

Two of our own sites are in scope: `cyberspace.cyou` (`POST /guide_code`, Django, CSRF +
session) and `gamersfantasy.my` (`POST /redeem.php`, `action=getsteamguardcode`,
`X-Requested-With: XMLHttpRequest`).

### Why this is architectural, not a mapping table

`0001_init.sql` declares `shared_secret_enc text not null`. A supplier account has no seed,
so **it cannot currently be inserted into the database at all**. The schema has no room for
the concept. This is not "add a lookup table"; it is introducing a second code source into a
system built assuming there is exactly one — and it lands on the money path.

## 2. Key facts established before designing

| Fact | Tag | Source |
|---|---|---|
| Steam username + password are the SAME value on our system and the supplier's. Only the order id differs per site. | `FACT-C` | Chaison, 2026-09-06 |
| ~~A supplier order id can be redeemed an UNLIMITED number of times.~~ **FALSIFIED 2026-09-06** — the site returned `{"code":"305","title":"REACHED LIMIT"}` on a real order. The cap is per order id and only a reset on their side clears it. | ~~`FACT-C`~~ → `FACT-V` | Observed live, 2026-09-06 |
| A supplier code exists only after a Steam login attempt; querying earlier returns a not-found, which is correct behaviour rather than a fault. | `FACT-V` | `local/sharewebsite.md` |
| Supplier codes expire (`CODE TIMEOUT` 404). | `FACT-V` | `local/sharewebsite-problem.md`, DELTARUNE |
| One supplier order id may hold SEVERAL rotating usernames (Black Myth: Wukong, `<a shared supplier order id>`, 6 accounts). | `FACT-C` | `local/websites/cyberspace.cyou.md` |
| Both portals reachable, HTTP 200, ~0.2s. | `FACT-V` | curl, 2026-09-06 |

**That assumption was load-bearing, and it was wrong.** The design took it as licence to skip
usage tracking, capacity limits, and any notion of an exhausted account. In reality each order
id has a finite number of redemptions, so:

- an order can run out mid-life, and today nothing predicts or reports that;
- allocation still spreads buyers across accounts but has no idea any of them is spent;
- **testing consumes real inventory** — the Ghost of Tsushima order was exhausted during this
  session's own verification runs.

What is handled now: `305` maps to a distinct `limit_reached` outcome and the buyer is told
plainly that the order needs a support reset rather than being told to wait. What is NOT yet
handled, and should be decided before this carries real volume: how many redemptions an order
actually gets, whether that count is visible to us anywhere before it runs out, and whether
allocation should avoid accounts nearing their cap.

## 3. Design

### 3.1 The supplier order id belongs to the ACCOUNT, not the buyer's order

`local/sharewebsite-problem.md` proposed mapping `gameshare order id -> (site, their order id,
username)`. That is rejected.

A supplier order id such as `<a supplier order id>` is not a buyer's order. It is **Chaison's own
purchase of the DELTARUNE account from cyberspace**. Every Shopee buyer we resell that account
to shares it. An order-level mapping would therefore store, once per buyer order, a value that
belongs to the account — 200 identical rows for 200 buyers — and it cannot express Wukong's
one-order-to-six-usernames shape at all.

Our system **already** resolves a GameShare order to a specific account
(`orders.account_game_id -> account_games -> steam_accounts`), which is exactly where the
username and password already live. So the supplier fields go on the account, and no new
table, join, or fulfilment write is needed.

Wukong then falls out for free: six normal account rows sharing one `supplier_order_id`,
rotated by the existing least-loaded allocator in `lib/fulfillment.ts`.

### 3.2 Data model — migration `0011`

```sql
alter table steam_accounts
  add column if not exists code_source       text not null default 'totp',
  add column if not exists supplier_site     text,
  add column if not exists supplier_order_id text;

alter table steam_accounts alter column shared_secret_enc drop not null;

alter table steam_accounts add constraint steam_accounts_code_source_shape check (
  (code_source = 'totp'     and shared_secret_enc is not null)
  or
  (code_source = 'supplier' and supplier_site is not null and supplier_order_id is not null)
);
```

Two deliberate choices:

- **`default 'totp'`** means all 7 existing accounts are correct the moment the migration
  lands. No backfill, and no window in which a live account is misrouted.
- **The CHECK constraint** is what stops the newly-nullable `shared_secret_enc` from
  permitting a half-configured account that passes every lookup check and only then throws at
  code generation. Same class of guard as `0008`.

Does NOT depend on `0009` (still unapplied). Must be added to `MIGRATIONS` in
`scripts/run-migrations.mjs`.

No change to `orders`, `account_games`, or `games`.

### 3.3 The provider layer — `lib/code-source/`

```
lib/code-source/index.ts          getCodeForAccount(account) -> CodeResult
lib/code-source/types.ts          CodeResult, CodeSourceAccount
lib/code-source/types.ts          also holds totpCode(), the offline path
lib/code-source/cyberspace.ts     POST /guide_code
lib/code-source/gamersfantasy.ts  POST /redeem.php
```

```ts
type CodeResult =
  | { ok: true;  code: string }
  | { ok: false; reason: "not_ready" | "expired" | "supplier_error" }
```

Each adapter's only job is turning one site's messy reality into that union — `not_ready` for
"no Steam login attempted yet", `expired` for `CODE TIMEOUT`, `supplier_error` for everything
else including timeouts and unparseable bodies. Adapters are independently testable against
recorded fixtures, so a supplier changing their HTML breaks one file with a failing test
rather than the money path.

### 3.4 The lookup branch

In `app/api/lookup/route.ts` the single call site changes:

```ts
const result = await getCodeForAccount(account);   // was: generateSteamGuardCode(...)
```

Everything before it — rate limiting, order verification, username match, account status — is
untouched.

This ordering matters for security: **the supplier is only ever contacted after the buyer has
already proven entitlement.** By that point there is nothing left to enumerate, which is what
lets us return a specific, helpful message for `not_ready` without weakening the route's
anti-probing property. The generic `NOT_FOUND` stays exactly as-is for every pre-verification
failure.

### 3.5 Rate-limiter outcome semantics — the bug this avoids

`lib/rate-limit.ts` sets `HEAVY_OUTCOMES = ["failure", "blocked"]` at `FAILED_ATTEMPT_WEIGHT`
(3x) against `MAX_WEIGHTED_ATTEMPTS_PER_ORDER` (20).

If `not_ready` were recorded as `failure`, a buyer pressing retry while waiting for Steam
would lock themselves out after **six presses** — a paying customer, locked out for 15
minutes, for performing exactly the behaviour we instructed.

Therefore `not_ready`, `expired` and `supplier_error` all record as **`unavailable`**, whose
existing docstring already reads *"order verified, but ... A real buyer hitting an ops
problem, NOT an attacker."* The semantic slot already exists; this design uses it rather than
inventing one. A regression test pins this.

### 3.6 Failure isolation

- Per-supplier **timeout** (5s) so a hanging portal cannot hold a Vercel function open.
- **`SUPPLIER_CODE_SOURCE`** kill switch, read per request. Note per `CHECKPOINT.md` that
  Vercel bakes env vars into a deployment, so flipping it also requires a redeploy. Off means
  supplier accounts return `unavailable`; TOTP accounts are unaffected.
- **The TOTP path never touches the network.** A total outage of our other sites cannot degrade
  the six accounts serving buyers today. This is the single most important property of the
  design: it makes the feature strictly additive to current reliability.

### 3.7 Buyer-facing behaviour

Decision (Chaison, 2026-09-06): instruction plus a retry press. **No polling** — polling would
burn multiple supplier calls per wait, eat the per-order rate limit, and risk the supplier
throttling our Vercel IPs.

| Reason | Message |
|---|---|
| `not_ready` | "Log in to Steam first. When Steam asks for your 5-character code, come back and press Get Code." |
| `expired` | "That code expired. Attempt the Steam login again, then press Get Code." |
| `supplier_error` | "Code service temporarily unavailable, contact support" |

`app/page.tsx` already renders `data.error` on a non-200, so this is a message change, not a
UI rebuild.

Side effect worth recording: this delivers the "hard gate" of the *second* open problem
(`local/sharewebsite-problem.md`, unlimited-redemption abuse) for supplier accounts **as
physics rather than as instructional copy** — the supplier genuinely has no code to hand out
until Steam has been prompted.

### 3.8 Admin panel

Required by Chaison, 2026-09-06: the admin panel must show and edit, per account, the Steam
username, the password, and the supplier order id, so that at any time the back end knows
what to key into the supplier's code system.

- Accounts form gains a **Code source** selector (`Own Steam Guard (TOTP)` / `Supplier
  website`), which conditionally reveals **Supplier site** and **Supplier order id**.
- `shared_secret` becomes required only for TOTP accounts, mirroring the CHECK constraint.
- The accounts list shows source, site and supplier order id, so an operator can read off
  exactly what to paste into the supplier portal manually if ever needed.
- Passwords keep the existing AES-256-GCM encryption path (`lib/encryption.ts`) unchanged.

### 3.9 Seeding

A script following the `scripts/seed-fleet.mjs` precedent: reads `local/websites/*.md`,
contains no credentials itself, idempotent on username.

## 4. Testing

Colocated `*.test.ts` per repo convention:

1. CHECK-constraint shape cases (valid totp, valid supplier, totp without seed, supplier
   without order id). **NOT AUTOMATED — the constraint is enforced in Postgres, so a
   real test needs a live database, which no test here has. Verified instead by the
   API-level shape validation in `app/api/admin/accounts/route.ts`, with the DB CHECK
   as the backstop. Confirm the constraint exists after applying 0011.**
2. Each adapter against recorded fixtures: success, not-ready, expired, garbage, timeout.
3. **Regression: the six-press lockout.** `not_ready` must map to `unavailable`, not
   `failure`.
4. TOTP accounts proven byte-identical in behaviour to before the change.
5. Kill switch off -> supplier accounts `unavailable`, TOTP unaffected.

## 5. Out of scope

- The unlimited-redemption abuse problem (confirmation gate, 6-redeem cap, T&C checkboxes).
  Deferred by Chaison; tracked separately in `local/sharewebsite-problem.md`.
- Polling / countdown UI.
- Automatic discovery of supplier order ids. Entered by hand in admin.
- Any change to the Shopee auto-fulfilment or delivery path.

## 6. Risks accepted

| Risk | Mitigation |
|---|---|
| Supplier changes their endpoint without notice | Adapter isolation + fixture tests + a single failing file rather than a broken route |
| Supplier throttles our Vercel IPs | No polling; one call per buyer press |
| Supplier down | `supplier_error` -> `unavailable`, TOTP path unaffected, kill switch available |
| Undocumented endpoints, no contract | Contracts established by running them (`FACT-V`), recorded in `local/websites/*-contract.md` |
