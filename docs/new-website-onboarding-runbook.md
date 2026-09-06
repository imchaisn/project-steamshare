# Onboarding a new source website — runbook

How a batch of accounts on another of our websites becomes a live, sellable Shopee listing.

**Built to be split across sessions.** Each stage below is self-contained: it states what must
already be true, what to do, and what must be true before the next stage starts. A session
handed one stage does not need the history of the others — §7 has a copy-paste brief per stage.

> **This file names no website and contains no credential.** The repo is public. Real order ids,
> usernames and passwords live only in gitignored `local/websites/<domain>.md`. Never paste one
> into a tracked file, a commit message, or a doc — including this one.

---

## The stages

```
1. RECORD      credentials into local/websites/<domain>.md
2. VERIFY      each account answers, without spending redemptions
3. UPLOAD      into GameShare (steam_accounts + account_games)
4. PROVE       one real end-to-end lookup
5. ACTIVATE    banners + listing copy
6. LIST        push to Shopee, map the listing        <- Chaison only
```

Stages 1-4 are ours. Stage 5 is ours. Stage 6 needs a browser console and is Chaison's alone.

---

## Stage 1 — RECORD

**Before:** you have credentials for a new website.

Create `local/websites/<domain>.md`, named exactly for the domain. Follow the shape of the
existing files; the table must have these columns, in this order:

```
| Order ID | Game | Username | Password | Verification code |
```

At the top record the portal URL and the API endpoint. If several accounts share ONE order id
(a rotation block), put that order id in prose above their table — the seed script reads it
from there.

Also add, in the file itself:

- **A stability rule.** Usernames and passwords are not to be rotated or changed once recorded.
  Drift is a silent failure: on at least one portal, "wrong username" and "no code yet" are the
  same response, so stale credentials look exactly like "please wait" to a buyer.
- **Anything the portal does that is not obvious** — auth handshake, required headers, whether
  a code exists only after a Steam login.

**Done when:** the file exists, `git status --porcelain local/` is empty (proving it is
ignored), and every row has all five columns.

---

## Stage 2 — VERIFY

**Before:** Stage 1 done.

Confirm each account answers **without spending a redemption**. This matters: an order id may
only be redeemed roughly 5-6 times before the site locks it and a human must ask them to reset
it. Verification must not eat that budget.

**The free check:** query an order on which no Steam login has been attempted. It answers
"code not found", which proves reachability, the auth handshake and the response shape — and
issues no code at all.

Some portals also expose an order-details action that returns the account without issuing a
code. Use it to confirm the recorded credentials match. **Confirm only — never adopt whatever
it returns as new credentials.** If it disagrees with the file, that is a discrepancy to
resolve at the source, not to copy down.

Recipes per site: `local/websites/HOW-TO-FETCH-CODE.md`.
The rule on when a fetch is permitted at all: `local/websites/WHEN-TO-FETCH-CODE.md`.

**Done when:** every account has answered once, no code was issued, and any account that
cannot be verified is marked in the file rather than uploaded.

**Do NOT:** loop, poll, retry, or "just check it works" a second time. That is how a saleable
order was exhausted on 2026-09-06.

---

## Stage 3 — UPLOAD

**Before:** Stage 2 done.

```bash
node scripts/seed-suppliers.mjs --dry-run    # read the plan first
node scripts/seed-suppliers.mjs              # then write
```

Reads `local/websites/*.md`, encrypts each password with the same AES-256-GCM path the app
uses, and upserts on username. Idempotent. Contains no credentials itself.

Requires: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCOUNTS_ENCRYPTION_KEY`.
It writes through PostgREST, because the direct DB password is broken — see `CHECKPOINT.md`
open item 1.

Then **link each account to a game** in `/admin` → Account-Game. An account with no game link
can never be allocated to a buyer, so this step is not optional.

**Done when:** the account count in the database matches the row count in the md files, and
every new account has a game link.

---

## Stage 4 — PROVE

**Before:** Stage 3 done.

Create one test order and run it end to end:

```bash
node scripts/setup-supplier-test-order.mjs --username <account> --order-id <slug>123 --dry-run
node scripts/setup-supplier-test-order.mjs --username <account> --order-id <slug>123
```

Then hit the live lookup with that order id and username. Expect "log in to Steam first" —
which is a **pass**: it proves the whole chain resolved and reached the site, and it costs
nothing.

To prove a real code end to end, someone must first attempt the Steam login on that account,
then press Get Code **once**. Per `TEAM.md` §7, nothing may be described as working until that
has actually happened — a build that compiles is not a buyer who was served.

**Done when:** one real code has been served through the live site, and the redemption ledger
in `/admin` shows it.

---

## Stage 5 — ACTIVATE (banners + copy)

**Before:** Stage 4 done. This stage needs no credentials at all, which makes it the easiest
one to hand to a separate session.

**Banners** — four 800x830 images per game:

```bash
node scripts/fetch-art.mjs                   # pull Steam art for all games
node scripts/gen-banners.mjs <slug> [slug…]  # render; omit slugs to do everything
```

Output lands in `brand/<slug>-banner-{1..4}.png`, uploaded to Shopee in that order:
1 = main banner, 2-4 = feature shots.

**Copy** — add the game to `docs/listing-copy.md`, which is the upload source of truth for
titles and descriptions. Match the existing entries' title convention exactly; do not invent a
new one. `docs/shopee-listings.md` is older and superseded for copy — use it only for the
banner/asset notes and the claims table.

Write the copy against live Steam data, not memory: prices, DLC and feature claims all drift.

**Done when:** four banners exist for the game and `docs/listing-copy.md` has a paste-ready
title and description for it.

---

## Stage 6 — LIST (Chaison only)

Create the Shopee listing, upload the banners, paste the copy, publish.

Then map it: **every new Shopee listing must be mapped by hand** so the automated pipeline can
allocate against it — see `CHECKPOINT.md`. An unmapped listing takes money and delivers
nothing.

**Done when:** the listing is live, mapped, and one real purchase has been fulfilled
end to end.

---

## 7. Briefs for delegating a single stage

Each block is self-contained. Hand one to a fresh session verbatim.

**Stage 1-2 (record + verify):**
> Add a new source website to this repo. Read `docs/new-website-onboarding-runbook.md` stages
> 1 and 2, and `local/websites/README.md` for the file convention. Credentials will be supplied
> by Chaison; record them ONLY in gitignored `local/websites/<domain>.md`. Verify every account
> using the free check in `local/websites/WHEN-TO-FETCH-CODE.md` — redemptions are finite,
> roughly 5-6 per order, and exhausting one needs a manual reset by the site's operators. Do
> not loop or re-check. Stop after stage 2 and report which accounts verified.

**Stage 3-4 (upload + prove):**
> Load an already-recorded source website into GameShare. Read
> `docs/new-website-onboarding-runbook.md` stages 3 and 4. Run `scripts/seed-suppliers.mjs`
> (dry-run first), link each account to a game in `/admin`, then create ONE test order with
> `scripts/setup-supplier-test-order.mjs` and confirm the live lookup resolves. Do not fetch a
> real code unless Chaison confirms he is at the Steam prompt — each fetch spends a finite
> redemption. Report the account count and the test order id.

**Stage 5 (banners + copy) — needs no credentials:**
> Produce Shopee assets for these games: <list>. Read
> `docs/new-website-onboarding-runbook.md` stage 5. Run `scripts/fetch-art.mjs` then
> `scripts/gen-banners.mjs <slug>` for four 800x830 banners each, and add paste-ready titles
> and descriptions to `docs/listing-copy.md` matching the existing convention. Write copy
> against live Steam data, not memory. Touch nothing under `local/` and no database.

---

## The three rules that survive every stage

1. **The repo is public.** No credential in any tracked file, ever. `local/` is the only place.
2. **Redemptions are finite.** Every fetch spends one. Verify with checks that issue no code;
   fetch a real code only when a buyer is at the Steam prompt asking for it.
3. **"It builds" is not "a buyer was served."** Only a completed lookup counts (`TEAM.md` §7).
