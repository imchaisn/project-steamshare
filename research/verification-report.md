# Verification report — commit f940c75, "Add a second code source: supplier-hosted Steam Guard codes"

Audited 2026-09-06. Scope: does the code do what the spec, the plan, the commit message and
`CHECKPOINT.md` claim? Which documents are now stale? No live requests were made to any supplier
site. No credentials, usernames, passwords or supplier order ids appear below — described by
location only.

---

## Summary

**The single most decision-relevant gap:** `CHECKPOINT.md` — the file a cold session reads first to
learn current state — contains **zero mentions** of this feature. No `code_source`, no `supplier`,
no migration `0011`, no `SUPPLIER_CODE_SOURCE`. `FACT-S`: `grep -in "supplier\|code_source\|0011" CHECKPOINT.md` → no matches. The implementation plan's own **Task 9** required exactly this update,
worded to state plainly that the feature is *"not proven live"* per `TEAM.md` §7 — that step was
never done. A cold session today would not learn this feature exists at all, let alone that it is
unverified.

Second-most important: the plan's **Task 8** (`scripts/seed-suppliers.mjs`) was never written —
`FACT-S`: `ls scripts/` shows only `seed-fleet.mjs`, `seed-shopee-listings.mjs`,
`seed-test-account.mjs`. There is currently no way to get a real supplier account into the database
except a manual admin-panel insert.

Everything else checked out well: the adapters, router, and rate-limit mapping are faithful to the
recorded contracts and pass 63/63 tests (`FACT-V` below); the commit message's factual claims are
all true, including a specific, checkable one about clearing "five pre-existing typecheck failures"
that was independently reproduced. Migration `0011` is correct and matches the spec exactly. The
feature has genuinely never run against production and nothing claims otherwise.

One working-tree nuance worth flagging: `.env.local.example` on disk **does** now document
`SUPPLIER_CODE_SOURCE` (lines 72–78), but `git diff --stat .env.local.example` shows this is an
**uncommitted** change, not part of commit `f940c75` (that commit's file list does not include
`.env.local.example`). So the commit as landed did not document the kill switch; a working-tree
edit — not yet committed — has since partially closed that gap. `CHECKPOINT.md` has separate
unrelated uncommitted edits in the tree (Shopee listing/pricing content) but none touch the supplier
feature — the "no mention anywhere" finding above holds for the file as it exists on disk right now.

---

## Spec section-by-section

Spec: `docs/superpowers/specs/2026-09-06-cross-supplier-code-retrieval-design.md`

| § | Claim | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Supplier order id belongs to the account, not the order; no new table/join/fulfilment write | **Implemented** | `FACT-S` `lib/code-source/types.ts:38-44` (`CodeSourceAccount` carries the fields); migration 0011 adds columns to `steam_accounts` only; `git show f940c75 --stat` shows no changes to `orders`, `account_games`, or `lib/fulfillment.ts`. |
| 3.2 | Migration 0011 — columns, nullable `shared_secret_enc`, CHECK constraint, default `'totp'` | **Implemented, matches spec verbatim** | `FACT-S` `supabase/migrations/0011_steam_accounts_code_source.sql:24-61`. Also adds a partial index not mentioned in spec 3.2 (harmless addition, documented in the file itself). **Not applied to production** — see "Missing FACT-V". |
| 3.3 | Provider layer: `index.ts`, `types.ts`, `totp.ts`, `cyberspace.ts`, `gamersfantasy.ts` | **Partially implemented** — behaviour matches, file layout does not. There is no `lib/code-source/totp.ts`; the TOTP wrapper (`totpCode`) lives inside `types.ts` instead (`FACT-S` `lib/code-source/types.ts:76-88`). `cyberspace.ts`, `gamersfantasy.ts`, `index.ts` exist exactly as named. |
| 3.4 | Single call-site change in `app/api/lookup/route.ts`, everything above it untouched | **Implemented** | `FACT-S` `app/api/lookup/route.ts:143`; `FACT-V` `diff` against `f940c75^:app/api/lookup/route.ts` shows every line above the account-status check is byte-identical; only the code-generation tail changed. |
| 3.5 | Rate-limit outcome semantics — `not_ready`/`expired`/`supplier_error` → `unavailable`, never `failure` | **Implemented** | `FACT-S` `lib/code-source/outcome.ts:28-52`; `FACT-V` regression test passes (see Test coverage). |
| 3.6 | 5s per-supplier timeout, `SUPPLIER_CODE_SOURCE` kill switch read per-request, TOTP path never touches network | **Implemented** | `FACT-S` `lib/code-source/types.ts:57` (`SUPPLIER_TIMEOUT_MS = 5000`); `lib/code-source/index.ts:47-49` (env read inside the function, not module scope); `FACT-V` test "a TOTP account never reaches a supplier fetcher" passes with fetchers that throw if called. |
| 3.7 | Buyer-facing messages; `app/page.tsx` needs no change since it already renders `data.error` | **Implemented, and the "no UI change needed" claim is true** | `FACT-S` messages match exactly, `lib/code-source/outcome.ts:33-50`; `FACT-V` `diff f940c75^:app/page.tsx app/page.tsx` → empty (zero changes); `FACT-S` `app/page.tsx:36` (`setError(data.error ?? ...)`) confirms the rendering path already existed. |
| 3.8 | Admin panel: code-source selector, supplier site/order id fields, separate-POST credential reveal | **Implemented** | `FACT-S` `app/admin/page.tsx:255-257,280-290,357,376` (selector, list columns, in-place order-id edit); `FACT-S` `app/api/admin/accounts/reveal/route.ts:22-55` (single-account POST, not part of the list GET). |
| 3.9 | Seeding script `scripts/seed-suppliers.mjs`, idempotent on username, reads `local/websites/*.md`, no credentials of its own | **Not implemented** | `FACT-S` `ls scripts/` — file does not exist. The implementation plan's Task 8 (which specifies this exact file) has all three of its steps left unchecked (`docs/superpowers/plans/2026-09-06-cross-supplier-code-retrieval.md:751,755,760` — all `- [ ]`). |
| 4 (Testing) | Five numbered test requirements | See "Test coverage honesty" below — 4 of 5 implemented, 1 not automated at all. |

---

## Claims that are not true

None found to be false. Every specific, checkable claim in the spec, the commit message, and the
plan's self-review that could be verified against the code turned out to be accurate, with two
caveats already covered above:

- Spec 3.3's file list (`lib/code-source/totp.ts`) does not match the actual layout (function
  inlined into `types.ts` instead) — a documentation/implementation mismatch, not a functional gap.
- The plan's own Task 8 and Task 9 checkboxes are honestly left unchecked in the plan file itself —
  the plan does not claim these were done. The dishonesty risk is not in the plan or commit message;
  it is that **nothing propagated their unfinished status to `CHECKPOINT.md`**, the file people
  actually read for current state.

Commit message specifically verified, claim by claim (`git show --stat f940c75`, full diff read):
- Migration/schema claims — `FACT-S`, matches `0011_steam_accounts_code_source.sql`.
- "No supplier failure can escape as anything but a `CodeResult`... TOTP path never touches the
  network" — `FACT-V`, tests pass, including a fetcher that throws (`index.test.ts:115-127`) and a
  TOTP path proven not to call a throwing fetcher stub.
- "Both suppliers return HTTP 200 for every business outcome" — `FACT-S`, confirmed against both
  `local/websites/*-contract.md` outcome tables; every case except cyberspace.cyou's CSRF failure
  (403) is HTTP 200.
- "rate-limit constants split into their own module... this also makes the outcome weighting
  testable for the first time" — `FACT-S` `lib/rate-limit-constants.ts:1-13` states the same
  reasoning; `FACT-V` `outcome.test.ts` does import `HEAVY_OUTCOMES`/`FAILED_ATTEMPT_WEIGHT` from it
  directly without touching `@/`.
- "tsconfig: `allowImportingTsExtensions`, which also clears five pre-existing typecheck failures in
  the existing test files" — **independently reproduced**, `FACT-V`: ran `npx tsc --noEmit` against
  a scratch copy of `tsconfig.json` with the flag removed (temporary file, deleted immediately after,
  confirmed via `git status` that nothing was left behind). Result: exactly five **pre-existing**
  test files fail with TS5097 (`lib/encryption.test.ts`, `lib/follow-up.test.ts`,
  `lib/fulfillment.test.ts`, `lib/shopee-logistics.test.ts`, `lib/totp.test.ts`) — matching the
  commit message's count exactly. (The new `lib/code-source/*.ts` files also need the flag, but
  those are new in this commit, not "pre-existing.")

---

## Test coverage honesty

`FACT-V` — ran:
```
set -a && . ./.env.local && set +a
node --test --experimental-strip-types lib/*.test.ts lib/code-source/*.test.ts
```
Result: **63 pass, 0 fail, 0 skipped** (full suite, includes pre-existing `lib/` tests as well as
the four new `lib/code-source/*.test.ts` files).

Judgment on whether the tests test the claimed behaviour, not trivia:

- **They do, for what they cover.** `outcome.test.ts` pins the exact six-press-lockout arithmetic
  (`MAX_WEIGHTED_ATTEMPTS_PER_ORDER / FAILED_ATTEMPT_WEIGHT > 6`) rather than just asserting a
  string equals `"unavailable"` — a change to either constant fails the test with an explanation.
  `index.test.ts` proves TOTP/supplier isolation behaviourally (passing a fetcher that **throws** if
  invoked) rather than just checking a branch was taken.
- **Fixture fidelity, checked against the recorded contracts:**
  - `adapters.test.ts` cyberspace fixtures (`CY_NOT_READY`, `CY_EXPIRED`, `CY_BAD_ORDER`,
    `CY_BAD_USERNAME`) are structurally and field-for-field identical to the bodies captured live in
    `local/websites/cyberspace.cyou-contract.md` §"Failure responses" (same `code`/`msg`/`title`
    keys, same 3-digit code values `401`/`404`/`103`/`306`). `CY_SUCCESS` is explicitly labelled
    `// INFERRED` in the test, matching the contract file's own admission that a real success body
    was never captured (`FACT-S` contract file line 65: "NOT reproduced live in this session").
  - `adapters.test.ts` gamersfantasy fixtures reproduce the exact discriminating structure from the
    contract: the not-ready case keeps the `(unavailable/in progress)` errmsg suffix that is the
    **only** signal separating it from a wrong-username response; the wrong-username fixture
    correctly omits that suffix; the bad-order fixture is a bare object (matching the contract's
    "object vs array" structural distinction, not a string check); the cooldown fixture reproduces
    `remainingCooldown` without `steamcode`. Usernames/codes are synthetic (`demo-ready-user`,
    `demo-stale-user`, `BCDFG`) as instructed — the STRUCTURE, not the content, is what was checked,
    and it matches.
  - One nuance: the contract file explicitly says the gamersfantasy "expired" state is
    **UNRESOLVED — MUST VERIFY** and warns not to invent a mapping for it. The adapter
    (`lib/code-source/gamersfantasy.ts:87-95`) and its tests honestly do **not** claim an `expired`
    outcome for this supplier at all — confirmed by inspection, no test asserts
    `classifyGamersfantasy(...)` returns `{ reason: "expired" }` for any input. This is the correct,
    honest behaviour the task asked to confirm.
- **Gap: spec §4 item 1 ("CHECK-constraint shape cases: valid totp, valid supplier, totp without
  seed, supplier without order id") has no automated test at all.** `FACT-S`:
  `grep -rn "steam_accounts_code_source_shape" lib/ supabase/` finds it only in the migration SQL
  itself and the plan document — no test file exercises it. This would require a live Postgres
  connection (there is no test-DB harness in this repo), so it is understandable that it wasn't
  automated, but it means the CHECK constraint's correctness rests entirely on manual SQL reasoning,
  never executed.
- **Gap, minor: spec §4 item 5** ("Kill switch off → supplier accounts `unavailable`") is proven only
  by composition of two separate tests, not one direct test: `index.test.ts` proves kill-switch-off
  yields `{ reason: "supplier_error" }`, and `outcome.test.ts` separately proves `supplier_error`
  always maps to the `unavailable` rate-limit outcome. The composed claim is true, but no single test
  asserts the words "kill switch" and "unavailable" together.

---

## Migration integrity

`FACT-V`:
```
ls supabase/migrations/*.sql | wc -l        → 11
grep -c "supabase/migrations/" scripts/run-migrations.mjs → 11
```
Both counts match; `0011_steam_accounts_code_source.sql` is present in the `MIGRATIONS` array
(`scripts/run-migrations.mjs:62`).

**However**, `git status --porcelain supabase/migrations/` shows:
```
?? supabase/migrations/0010_orders_auto_ship.sql
```
`0010` is **untracked** — it exists on this machine's disk (from concurrent work, per the task
context) but is not in git. The array in `scripts/run-migrations.mjs` references it anyway
(`scripts/run-migrations.mjs:62`, committed at `b37af37`/`210bfab`). Net effect: **a fresh clone of
this public repo would have a `MIGRATIONS` array entry pointing at a file that does not exist**,
which throws when `run-migrations.mjs` is invoked without a specific selector. Not something to fix
here per instructions — flagging only.

---

## Stale documents

- **`CHECKPOINT.md` — stale.** No mention of `code_source`, `supplier`, migration `0011`, or
  `SUPPLIER_CODE_SOURCE` anywhere in the file (`FACT-S`, full-file grep, no matches). Neither the
  "What's built" table nor the account inventory table (which lists all 7 accounts by
  username/game/status) has been updated to reflect that an account can now be `code_source =
  'supplier'`. This is exactly the update the plan's Task 9 called for and left undone.
- **`local/websites/gamersfantasy.my.md` — stale, and unannotated.** Still records the order's
  username as the older value; a live `prechkorder` call recorded in
  `local/websites/gamersfantasy.my-contract.md` (lines 5-9, 251-256) found the current real username
  differs and explicitly flags: *"This is worth flagging to Chaison separately... the local record
  may be stale."* That flag exists **only inside the contract file**; `gamersfantasy.my.md` itself
  carries no note that its own table is out of date. Someone reading only `gamersfantasy.my.md` (the
  file the seed script, once it exists, would presumably read) would get the stale value with no
  warning.
- **`local/sharewebsite-problem.md` — stale, not marked superseded.** Its "Proposed solution" for
  cross-account code sharing (2026-09-06 entry, an order-level mapping:
  `gameshare order ID → (other website, other website's order ID, same Steam username)`) is exactly
  the design the spec's §3.1 says was **rejected** in favor of the account-level `supplier_order_id`
  actually built. `local/sharewebsite-problem.md` has no edit, note, or cross-reference marking this
  section resolved/superseded by the design doc — a reader would still see it as "idea only, still
  need to work out."
- **`.env.local.example`** — on disk now documents `SUPPLIER_CODE_SOURCE` (lines 72-78, wording
  matches the plan's Task 9 Step 1 almost verbatim). But `git diff --stat .env.local.example` shows
  this is **uncommitted** — not part of `f940c75`. As landed, the commit shipped a new env var with
  no committed documentation of it anywhere.

---

## Open markers

`FACT-V`, ran:
```
grep -rn "TODO(unconfirmed)\|SPEC AMBIGUITY\|UNRESOLVED\|UNSOURCED — MUST VERIFY" lib/
grep -n "UNRESOLVED\|UNSOURCED — MUST VERIFY" local/websites/cyberspace.cyou-contract.md local/websites/gamersfantasy.my-contract.md
```

In `lib/`: two `TODO(unconfirmed)` markers in `lib/shopee-api.ts` and one `SPEC AMBIGUITY` in
`lib/shopee-auth.ts` — all pre-existing, unrelated to this feature (Shopee integration, not
code-source). Nothing under `lib/code-source/` carries any open marker — every ambiguity the
researchers found was resolved into an explicit, tested decision rather than left as a TODO in code.

In the two contract files (genuinely open, still `UNRESOLVED`/`UNSOURCED — MUST VERIFY`):
- **cyberspace.cyou**: real success-response body shape (`msg`/`title` text on success — only the
  `code` field's shape is inferred); rate-limit/throttling behaviour; masked CSRF token's outer
  validity window (only proven valid ≥90s); whether `csrfmiddlewaretoken` also works as a body field;
  malformed/missing-field request handling.
- **gamersfantasy.my**: the **expired-code state** — explicitly "not established," confirmed above
  the code does not fabricate a mapping for it; the cooldown/rate-limit trigger threshold and exact
  shape; whether the `Referer` header is actually checked; timeout behaviour.

All of these are honestly still open — none have been quietly resolved by assumption in the shipped
code. The `expired` gap for gamersfantasy.my in particular is handled exactly as advertised: absence
of the not-ready suffix falls through to `supplier_error`, never to a fabricated `expired`.

---

## Missing FACT-V

Per `TEAM.md` §7, a claim that something works in production needs a command, output, and date. For
this feature, that evidence **does not exist**, and nothing found claims otherwise:

- **Migration 0011 has not been applied to production.** No file references a successful apply — no
  `FACT-V` line anywhere states it was run against the live Supabase project. (Compare with how
  migration 0005 in `CHECKPOINT.md` open item 6 carries an explicit "RESOLVED... applied to
  production and verified" note — 0011 has no equivalent, anywhere.)
- **No real supplier code lookup has ever been served end-to-end.** No `FACT-V` for a live
  `/api/lookup` call against a `code_source = 'supplier'` account exists in any tracked or untracked
  file reviewed. The success-response bodies for *both* suppliers are themselves marked as inferred,
  not captured live, in their contract files — so even the researchers' own manual testing never
  produced a real success case, let alone a production round trip.
- **`SUPPLIER_CODE_SOURCE` has not been confirmed set in Vercel production.** No file records this
  either way with a command/output; `lib/code-source/index.ts:47-49` defaults it to `false` (disabled)
  when unset, which is the safe default, but nothing states the current production value.
- **No account currently in the database has `code_source = 'supplier'`.** Consequence of migration
  0011 not being applied and `scripts/seed-suppliers.mjs` not existing (§3.9) — there is currently no
  mechanical way for a supplier account to exist in production at all.

Nothing in the spec, the plan, the commit message, or `CHECKPOINT.md` (checked explicitly, since it
has zero mentions of the feature) asserts this is live, applied, or proven — so there is no false
claim to correct here. The gap is a documentation *omission*, not a documentation *lie*: the feature
is honestly unmentioned rather than dishonestly claimed. The risk is that "unmentioned" in
`CHECKPOINT.md` reads, to a cold session, identically to "doesn't exist" — which is itself the
finding worth acting on before this is forgotten.
