# Adversarial review — commit `f940c75` "Add a second code source: supplier-hosted Steam Guard codes"

**Reviewer:** adversary pass (red-team). **Date:** 2026-09-06.
**Scope:** commit `f940c75` only, against the intent in
`docs/superpowers/specs/2026-09-06-cross-supplier-code-retrieval-design.md`.
**Out of scope (another agent):** doc/CHECKPOINT accuracy. No fixes applied; nothing modified.
**Not done, deliberately:** no request was made to `cyberspace.cyou` or `gamersfantasy.my`.

Evidence tags: `FACT-V` = I ran it, command and output shown. `FACT-S` = I read it, file and line
cited. `ASSUMPTION` = reasoned, not verified. This file is tracked and public: no credential values
appear below, only locations.

---

## Verdict

**SHIP WITH CONDITIONS.**

The supplier feature itself is well built. Every attack I aimed at the new code path — proxy
bypass, SSRF, enumeration, timing, rate-limit weakening, a fabricated code reaching a buyer,
supplier failure escaping as a 500 — failed. The refactor is byte-clean.

What earns the conditions is not the supplier path. It is `POST /api/admin/accounts/reveal`,
which converts "someone gets the admin password" from a *tampering* incident into a
*full plaintext credential disclosure* incident, on a repo whose own CHECKPOINT says that
password is still a placeholder, behind a login endpoint with no throttling at all.

Conditions, in order:

1. Confirm `DASHBOARD_PASSWORD` in **Vercel production** is a real high-entropy secret, not the
   placeholder `CHECKPOINT.md:394` describes, and add rate limiting to `POST /api/auth/login`.
   Until both are true, do not deploy the reveal endpoint. (F1)
2. Audit-log every reveal. (F2)
3. Tighten `steam_accounts_code_source_shape` and trim in the POST validator. (F4)
4. Do not create a supplier account until `SUPPLIER_CODE_SOURCE=true` is set **and** redeployed.
   As committed it is unset. (F3)

---

## Findings

### F1 — `POST /api/admin/accounts/reveal` makes admin-password compromise a fleet-wide plaintext disclosure, behind an unthrottled login

**Severity: High (conditional on the production `DASHBOARD_PASSWORD`). Exploitability: trivial once inside; the cost is entirely in getting inside.**

The gate itself is sound. I could not bypass it:

`FACT-V` — 12 path spellings, POST, against the running dev server (`--path-as-is`):

```
/api/admin/accounts/reveal                        307   (-> /admin/login?next=...)
/api/lookup/../admin/accounts/reveal              307
/api/lookup/%2e%2e/admin/accounts/reveal          307
/api/lookup/..%2fadmin%2faccounts%2freveal        404
/api/lookup%2f%2e%2e%2fadmin%2faccounts%2freveal  404
//api/admin/accounts/reveal                       308 -> /api/admin/accounts/reveal (-> 307)
/api/admin/accounts/reveal/                       308 -> /api/admin/accounts/reveal (-> 307)
/api/auth/../admin/accounts/reveal                307
/games/../api/admin/accounts/reveal               307
/api/admin/accounts/reveal%2e                     307
/API/admin/accounts/reveal                        307
/api/lookupx/../admin/accounts/reveal             307
```

`FACT-V` — the CVE-2025-29927 class bypass (a spoofed internal recursion header) also fails on
Next 16.2.7; six variants of `x-middleware-subrequest` (`middleware`, `src/middleware`, `proxy`,
`src/proxy`, and the 6x-repeated colon forms) all returned `307`.

`FACT-S` — the prefix list in `proxy.ts:5-18` contains no prefix that `/api/admin/...` can match;
I enumerated every route handler in the app (`app/api/{admin/*,auth/login,cron/follow-up,health,lookup,shopee/callback,webhooks/shopee}`)
and no public prefix over-matches an admin route. `FACT-S` — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:15`
confirms Proxy runs before routes render; line 219 of the same file is the framework's own warning
that Proxy must not be the *only* gate.

So the gate holds. The problem is what is now behind it, and what the gate is worth.

**What changed.** `FACT-S` — before this commit, `GET /api/admin/accounts` selected
`id, username, status, recovery_email, created_at` (diff hunk at `app/api/admin/accounts/route.ts`);
no endpoint in the app returned a decrypted account password. After it,
`app/api/admin/accounts/reveal/route.ts:35-54` accepts any `id`, reads `password_enc`, and returns
`password: await decrypt(data.password_enc)` in the response body. `GET /api/admin/accounts:11-16`
still returns every account id. Two requests in a loop is the whole fleet in plaintext.

The route's own docstring (`reveal/route.ts:8-15`) argues one-at-a-time "keeps the blast radius to
the account actually being worked on." That is true against *incidental* exposure — browser cache,
intermediaries — and it is a genuine improvement over putting passwords in the list GET. It is not
true against an attacker, who simply iterates. The comment should not be read as a security control.

**What the gate is worth.** `FACT-S` — `CHECKPOINT.md:394`: "**`DASHBOARD_PASSWORD`** — still a
placeholder; change in `.env.local` **and** Vercel env vars. Guards the admin panel, which exposes
every stored Steam credential." That note predates this commit; this commit makes the second
sentence literally true for plaintext passwords, which it previously was not.

`FACT-S` — `app/api/auth/login/route.ts:7` is a bare string comparison against
`process.env.DASHBOARD_PASSWORD`. There is no throttling: `FACT-V` — `grep -rn "rate" app/api/auth/`
returns nothing, and 15 consecutive wrong-password POSTs to `/api/auth/login` returned
`401 401 401 401 401 401 401 401 401 401 401 401 401 401 401` with no lockout, no delay, no
counter. `/api/auth/` is in `PUBLIC_PREFIXES` (`proxy.ts:11`), so the limiter never sees it.
There is no second factor and no IP allowlist.

`FACT-S` — `lib/auth.ts:43-47`: `verifySession` deliberately does not enforce expiry, so a stolen
cookie is valid until `AUTH_SECRET` rotates. `FACT-S` — `lib/auth.ts:72-75`: `verifyApiSecret` is a
non-constant-time `===`, and `proxy.ts:28-30` honours `x-api-secret` on every non-public route, so
`API_SECRET` is a second, equally total key to the same data.

`FACT-V` — the local `DASHBOARD_PASSWORD` is present and is a 24-character single-segment
mixed-case token, i.e. not a dictionary phrase; and `git grep` of the value across **all** revisions
finds no occurrence, so it has never been committed. I cannot read the Vercel production value, so
whether the deployed gate is strong is **UNSOURCED — MUST VERIFY** by the main session.

**Exploitability, stated plainly.** An unauthenticated internet attacker cannot reach this endpoint;
I tried and failed. The realistic paths in are: (a) the production `DASHBOARD_PASSWORD` is still the
placeholder or is otherwise guessable, in which case unlimited online guessing makes this a
straightforward full-fleet compromise; (b) the admin cookie or `API_SECRET` leaks, and the cookie
never expires. Given the repo's own history of a credential leak after going public
(`CHECKPOINT.md:380-391`), (b) is not hypothetical.

**Smallest fixes.**
- Rate-limit `POST /api/auth/login` on IP. `lib/rate-limit.ts` already exports everything needed
  (`getClientIp`, `checkRateLimit`, `recordLookupAttempt`); this is ~10 lines in the login handler.
- Require the operator to re-submit `DASHBOARD_PASSWORD` in the reveal request body and compare it
  server-side — a step-up that costs one field and defeats a stolen cookie.
- Verify and, if in doubt, rotate the Vercel `DASHBOARD_PASSWORD` before this deploys.

### F2 — Reveal writes no audit record

**Severity: Medium. Exploitability: this is not itself an entry point; it removes the ability to detect or scope an incident.**

`FACT-S` — the buyer path logs every code it serves: `app/api/lookup/route.ts:156-159` inserts into
`code_access_log`. `FACT-S` — `app/api/admin/accounts/reveal/route.ts:22-54` contains no insert of
any kind. A compromised admin session can dump every Steam password in the fleet and leave nothing
behind but a Vercel access log line with no account id in it.

**Smallest fix:** one `supabase.from(<audit table>).insert({ account_id: body.id, ip: getClientIp(request) })`
in the reveal handler, before returning. `code_access_log` can be reused if a marker column is
acceptable.

### F3 — `SUPPLIER_CODE_SOURCE` is unset, and the admin UI offers supplier accounts anyway

**Severity: Medium (service degradation for paying buyers). Exploitability: not an attack — an operator footgun that fires on the first supplier account created.**

`FACT-V` — `.env.local` contains no `SUPPLIER_CODE_SOURCE` line at all (an `awk` match on
`^SUPPLIER_CODE_SOURCE=` produced no output). `FACT-S` — `.env.local.example` ships it blank.
`FACT-S` — `lib/code-source/index.ts:47-49` requires the string `"true"` exactly; anything else
means `supplierEnabled === false`, and `index.ts:67` then returns `supplier_error` for every
supplier account, which `lib/code-source/outcome.ts:43-51` turns into a **503 "Code service
temporarily unavailable, contact support"**.

`FACT-S` — meanwhile `app/admin/page.tsx` gains a "Supplier website" option in the code-source
selector with no indication of the switch state, and `app/api/admin/accounts/route.ts:64-82`
accepts and stores such an account happily.

So: an operator adds a supplier account through the new UI, links it to a game, a buyer pays, and
every single lookup returns 503 until someone sets the env var **and redeploys** (the redeploy
caveat is correctly documented at `index.ts:42-45`, and it is the same trap `CHECKPOINT.md` records
for `SHOPEE_AUTO_FULFILL`). Nothing in the product surfaces this.

**Smallest fix:** have `GET /api/admin/accounts` return `supplierEnabled: process.env.SUPPLIER_CODE_SOURCE === "true"`
and have the admin page disable the "Supplier website" option with a one-line explanation when it
is false. Alternatively refuse the POST with a named error.

### F4 — `steam_accounts_code_source_shape` accepts rows that break the lookup at runtime

**Severity: Medium. Exploitability: requires DB or admin write access; the realistic trigger is an operator typo, not an attacker.**

This is the direct answer to "can you write a row that passes the CHECK but still breaks the lookup?"
Yes, three ways.

`FACT-S` — the constraint (`supabase/migrations/0011_steam_accounts_code_source.sql:54-59`) tests
**null-ness only**:

```sql
(code_source = 'totp'     and shared_secret_enc is not null)
or
(code_source = 'supplier' and supplier_site is not null and supplier_order_id is not null)
```

1. **Empty-string order id.** `supplier_order_id = ''` is not null, so the row is accepted.
   `FACT-S` — `lib/code-source/index.ts:69` tests `!account.supplier_order_id`, and `''` is falsy →
   `supplier_error` → 503 to a buyer who has already paid. The migration's own comment
   (lines 38-43) says the CHECK exists precisely to stop "a row that passes EVERY check in the
   lookup route ... and only then throws at code generation." This row does exactly that, one
   failure mode softer.
2. **Whitespace order id, and an inconsistency between the two write paths.** `FACT-S` —
   `app/api/admin/accounts/route.ts:65` validates with `!supplierOrderId`, so `"   "` passes and is
   inserted **untrimmed** (line 102). `FACT-S` — the PATCH path at line 147-154 *does* trim and
   *does* reject blank. Same field, two different rules, in one file. The whitespace row then
   reaches the adapter, which trims it to `""` (`cyberspace.ts:145`, `gamersfantasy.ts:108`) and
   sends an empty order id to the supplier.
3. **Unknown supplier site.** The migration deliberately declines to pin the vocabulary in SQL
   (lines 63-69, citing 0008), so a direct SQL insert with `supplier_site = 'anything'` passes.
   `FACT-S` — `index.ts:69` then fails `isSupplierSite` → `supplier_error` → 503. The API layer
   does guard this (`accounts/route.ts:74`, `157`), so this one is SQL-only. The migration's
   reasoning for not pinning the vocabulary is sound and I am not arguing against it — but shape
   and non-emptiness are not vocabulary.

`FACT-V` — the design's stated test plan (`spec §4.1`, "CHECK-constraint shape cases") was **not
implemented**: `lib/code-source/*.test.ts` contains no constraint test, only TypeScript-level
tests. `node --experimental-strip-types --test lib/code-source/*.test.ts` → 31 pass, 0 fail, and
none of them touch SQL.

**Smallest fix:** extend the CHECK to `and length(btrim(supplier_order_id)) > 0 and length(btrim(supplier_site)) > 0`,
and change `accounts/route.ts:65` to `!supplierOrderId?.trim()` so POST matches PATCH.

### F5 — The 409/503 messages tell a buyer their account came from a third party

**Severity: Low. Exploitability: any buyer of a supplier-backed account sees it, at zero cost. Not usable for enumeration.**

`FACT-S` — `lib/code-source/outcome.ts:44-46` states the requirement: "a buyer must never learn that
their account came from a third party, and naming it would leak our supply chain to competitors."
The `supplier_error` copy honours that, and `outcome.test.ts:55-61` pins it.

But the *not_ready* copy at `outcome.ts:33-34` — "Log in to Steam first. When Steam asks for your
5-character code, come back and press Get Code." — is produced **only** on the supplier path. A TOTP
account can never emit it: `index.ts:63-65` routes to `totpCode`, which returns either a code or
`supplier_error`. So the message class itself is the tell. A competitor who buys one order learns
which titles GameShare resells rather than owns, which is the thing the file says must not happen.

This leaks nothing to an *unentitled* attacker — see "Attacks that failed" — so it is a
business-confidentiality issue, not a security one.

**Smallest fix:** if the requirement is real, reword to something a TOTP account could also
plausibly produce, or accept the leak explicitly and delete the claim from the docstring.

### F6 — cyberspace makes two outbound requests per buyer press, not one

**Severity: Low. Exploitability: bounded; an attacker would need to own orders.**

`FACT-S` — the spec's accepted risk table (§6) mitigates "supplier throttles our Vercel IPs" with
"No polling; one call per buyer press." `FACT-S` — `lib/code-source/cyberspace.ts:122` and `:133`
make **two** round trips per press: an uncached homepage GET for the CSRF pair, then the POST. The
comment at lines 110-115 explains the decision not to cache (a stale token would 403 every lookup)
and it is a defensible trade — but it doubles the volume the mitigation was sized against.

Ceiling on abuse: `FACT-S` — `MAX_WEIGHTED_ATTEMPTS_PER_ORDER = 20` per 15 min
(`lib/rate-limit-constants.ts:24`), and supplier failures cost 1x, so one order yields at most
~20 presses → ~40 supplier requests per 15 minutes. To matter, an attacker would need to buy many
orders. Real but small. If the supplier does start blocking our egress IPs, every supplier account
fails for every buyer simultaneously.

**Smallest fix if it ever bites:** cache the CSRF token pair for the ~90s it was verified reusable
across (`cyberspace.ts:112`), which halves the traffic without risking a long-stale token.

### F7 — Failure isolation is true in code, not quite true on the platform

**Severity: Low. Exploitability: none today.**

The isolation claim survives every code-level attack I made (see below). The one place I can
falsify it is resource contention, not logic: `FACT-S` — `types.ts:57` gives a supplier 5 seconds,
and `index.ts:82` applies that to the whole adapter call. A blackholed supplier therefore pins a
Vercel invocation for 5s per supplier lookup, in the same function pool that serves TOTP lookups.
Under a concurrency cap, that is shared capacity, so a supplier outage *can* add queueing latency
for TOTP buyers even though no TOTP code path touches the network.

`ASSUMPTION` — this depends on the Vercel plan's concurrency behaviour, which I did not verify.
Practically it is zero risk today: there are no supplier rows and the kill switch is off (F3). No
fix warranted; worth an ops note if supplier volume ever grows.

Two things I checked and found clean while looking for worse: no Supabase transaction or connection
is held across the supplier fetch (`createAdminClient` is PostgREST-over-HTTP and all DB reads
complete before `getCodeForAccount` is called, `app/api/lookup/route.ts:96-143`), and the
password is decrypted *after* the code is in hand (`route.ts:154`), so a supplier outage does not
even exercise the decryption key.

### F8 — A real Steam username is added to two more tracked files (informational)

**Severity: Informational. Not a ship blocker.**

`FACT-V` — the commit's message asserts "Test fixtures use synthetic usernames and codes." Mostly
true and well done: every adapter fixture in `lib/code-source/adapters.test.ts` uses synthetic
values (`demo-ready-user`, `demo-stale-user`, `BCDFG`, a published all-0x01 TOTP vector), and the
two docs under `docs/superpowers/` contain no order ids, codes or passwords — the spec refers to a
supplier order id only as a redacted placeholder. `FACT-V` — `git grep` across the commit's added
lines for credential-shaped tokens surfaced nothing else.

The exception: a **real Steam username of a live selling account** is used as a fixture at
`lib/code-source/index.test.ts:12` and appears twice in `docs/superpowers/plans/2026-09-06-cross-supplier-code-retrieval.md`
(lines 170 and 411). `FACT-V` — that same username was already in tracked files before this commit
(`CHECKPOINT.md:633`, `docs/order-fulfillment-sop.md:98`), so the commit adds no new exposure — it
just makes the commit message's claim inaccurate. A username alone is not a credential.

**Smallest fix:** replace it with `demo-account`, which the same test file already uses one
declaration below.

---

## Attacks that failed

Listed because a failed attack is evidence of coverage. Each of these was tried and did not work.

- **Reaching `/api/admin/accounts/reveal` unauthenticated.** 12 path spellings — dot-segment
  traversal from every public prefix, encoded `%2e%2e`, encoded slashes, double slash, trailing
  slash, trailing `%2e`, uppercase host-path, and a prefix-confusion attempt via `/api/lookupx/` —
  all 307 to `/admin/login`, or 404, or a 308 that lands on the 307. `FACT-V`, output in F1.
- **The middleware-recursion header bypass (CVE-2025-29927 class).** Six header values, all 307.
  Next 16.2.7 is not vulnerable. `FACT-V`.
- **CSRF against reveal from a hostile page.** `FACT-S` — `app/api/auth/login/route.ts:24` sets the
  session cookie `sameSite: "lax"`, which suppresses the cookie on cross-site POST and `fetch`. The
  route handler emits no CORS headers, so the response is unreadable cross-origin regardless. No
  fix needed.
- **Order-id enumeration via the new status codes.** `FACT-S` — `app/api/lookup/route.ts:74-123` is
  unchanged by this commit (confirmed against `git show f940c75 -- app/api/lookup/route.ts`: the
  first hunk touching behaviour is at line 134, after every entitlement check). An unverified order,
  an unknown account, and a wrong username all still return the identical generic 404 at
  `route.ts:78`, `:92`, `:107`, `:121`. 409 and 503 are unreachable until order **and** username
  **and** active status have all matched. There is nothing left to enumerate at that point.
- **Username brute-force made cheaper by the new `unavailable` weighting.** This was my strongest
  hypothesis and it does not hold. `FACT-S` — the wrong-username branch (`route.ts:115-123`) still
  records `"failure"`, which `lib/rate-limit-constants.ts:68` keeps in `HEAVY_OUTCOMES` at 3x
  against a 20-point order budget — still ~6 guesses per order per 15 minutes, exactly as before.
  Every path that records the light `unavailable` weight sits *after* the username match, so an
  attacker cannot buy cheap attempts without already possessing the answer. The weighting change is
  not exploitable.
- **A timing oracle from the supplier's hundreds of milliseconds / 5s timeout.** Real latency
  difference, no usable signal: it only appears after the username has matched, and at that point
  the *status code* already distinguishes the cases completely (200 vs 409 vs 503 vs 404). Timing
  reveals nothing the response does not state outright.
- **SSRF via `supplier_site` or `supplier_order_id`.** Both endpoint URLs are module constants
  (`cyberspace.ts:16-17`, `gamersfantasy.ts:14`); `supplier_site` selects a fetcher from a
  two-entry record and is allowlisted at `types.ts:64-66`, at `accounts/route.ts:74` and `:157`, and
  again at `index.ts:69` — three independent checks. No attacker-controlled value reaches a URL, a
  hostname, or a header. `supplier_order_id` reaches only a `JSON.stringify` body
  (`cyberspace.ts:144`) and a `URLSearchParams` body (`gamersfantasy.ts:107`), both of which encode.
  I could not construct a header-injection, request-splitting, or host-redirection payload.
- **Serving a supplier-controlled value to a buyer as if it were a Guard code.** Both adapters
  require the Steam Guard alphabet before returning `ok: true` (`cyberspace.ts:80`,
  `gamersfantasy.ts:77`). `FACT-V` — `adapters.test.ts:79-87` proves a 4-digit status that passes
  the *supplier's own* success heuristic is rejected by ours. Non-string, null, array and object
  `code` values all fall through to `supplier_error`.
- **Making a supplier failure escape as a 500 on the money path.** Adapters catch their own
  throws; `index.ts:78-88` catches again. `FACT-V` — `index.test.ts:115-127` ("a fetcher that
  throws becomes supplier_error, never a 500") passes.
- **Making a TOTP lookup touch the network.** `FACT-V` — `index.test.ts:64-74` injects fetchers
  that throw if called and the TOTP lookup succeeds; `index.test.ts:88-97` proves the kill switch
  disables supplier accounts and leaves TOTP untouched. `FACT-S` — the `code_source !== "supplier"`
  test at `index.ts:63` routes null/legacy/unknown values to TOTP, so migration 0011 cannot
  misroute a live account.
- **Finding something dropped or altered in the rate-limit split.** Nothing was.
  `FACT-V` — `diff -u <(git show f940c75^:lib/rate-limit.ts | sed -n '44,126p') <(sed -n '14,96p' lib/rate-limit-constants.ts)`
  produced **no output**: the constants and types block is byte-identical, including all four
  weights and caps (20 / 900s / 300 / 900s / 1x / 3x / 64) and `HEAVY_OUTCOMES = ["failure","blocked"]`.
  Every one of the 20 exported names in the old file still exists, split across the two new files
  (7 consts + 6 types in `rate-limit-constants.ts`, 7 functions in `rate-limit.ts`), and
  `rate-limit.ts:48` re-exports the constants module, so every `from "@/lib/rate-limit"` import site
  is unchanged — `FACT-V`, `npx tsc --noEmit` exits 0.
- **Breaking the build with the new `.ts` import specifiers / `allowImportingTsExtensions`.**
  `FACT-V` — `npx tsc --noEmit` exits 0, and a `GET /api/lookup` against the dev server returned 405
  (the correct answer for a POST-only handler), which means the whole `lib/code-source` module graph
  compiled and loaded cleanly.
- **Finding a real credential in the commit.** None. `FACT-V` — see F8; the only hit is a username
  already public in the repo.

---

## Residual risk

1. **The production `DASHBOARD_PASSWORD` is unverified.** Everything in F1 hinges on it and I
   cannot read Vercel's env. `UNSOURCED — MUST VERIFY`. If it is the placeholder
   `CHECKPOINT.md:394` describes, F1 is not "conditional High", it is a live full-fleet plaintext
   disclosure the moment this deploys.

2. **Pre-existing, out of this commit, and worse than anything in it — working lookup credentials
   are published in the public repo.** `docs/order-fulfillment-sop.md:88-98` states the derivation
   rule for the test order ids *and* tabulates them against six real usernames;
   `CHECKPOINT.md:626-634` repeats the table, and `CHECKPOINT.md:370` records that one of those
   pairs "still returns a password and a live 5-char code." That is an unauthenticated
   password-and-Guard-code retrieval for six live selling accounts, documented step by step, in a
   public repository. It is not introduced by `f940c75` and is therefore outside my verdict, but it
   is squarely inside the mandate's "take codes they did not pay for" and should be triaged ahead
   of anything above: either those test orders stop resolving, or the table comes out of the public
   tree and the accounts are rotated.

3. **The `unavailable` weighting is safe *given the current call sites*.** It is safe because
   nothing reachable before entitlement records it (F-analysis above). That is a property of the
   route's ordering, not of the limiter, and nothing enforces it. If a future change ever records
   `unavailable` before the username match at `app/api/lookup/route.ts:115`, username brute-force
   silently gets 20 guesses per window instead of 6, with no test failing.
   `lib/code-source/outcome.test.ts` pins the mapping but not the ordering.

4. **Adapter correctness rests on vendor copy.** `gamersfantasy.ts:30` separates "no code yet" from
   "our stored username is stale" by the literal substring `"(unavailable/in progress)"`. The file
   chooses the safe fall-through direction and says so, and the choice is right — but a vendor
   reword turns a diagnosable ops problem into a generic 503 with no alert. Nothing monitors for a
   rising `unavailable` rate.

5. **Both suppliers' success bodies are inferred, not observed.** `adapters.test.ts:9-12` labels
   them honestly. The success path — the only path that hands a code to a buyer — has therefore
   never been exercised against a real response from either supplier. The first real supplier sale
   is the first test of it.

6. **`SUPPLIER_CODE_SOURCE` shares the redeploy trap that already bit `SHOPEE_AUTO_FULFILL`.**
   Correctly documented at `lib/code-source/index.ts:42-45`; still a live operational hazard, and
   it is the mechanism by which F3 turns into buyer-visible 503s.
