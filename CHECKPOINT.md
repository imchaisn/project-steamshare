# Project Steamshare — Checkpoint

*Living status file — current state only, not a history log. Dated history lives in
`PROJECT-LOG.md` (Personal Assistant workspace). Operational docs: `docs/order-fulfillment-sop.md`,
`docs/steam-account-onboarding-runbook.md`, `docs/family-view-lockdown.md`, `docs/policies.md`.*

**Last updated:** 2026-08-25

---

## Status: LIVE and working end-to-end

`gameshare.space` serves real, rotating Steam Guard codes to real order lookups.

```
POST https://www.gameshare.space/api/lookup
{"orderId":"T123","username":"ssp266"}
→ 200 {"username":"ssp266","password":"<redacted>","code":"<5-char Guard code>"}
```

Verified on production: codes rotate between requests (live TOTP, not cached), wrong username
returns the same generic 404 as a bad order id (can't be used to probe usernames), username match
is case-insensitive, `/terms` 200s, admin gate redirects to login, favicon serves.

### What's built
| Piece | State |
|---|---|
| Buyer lookup (order id + Steam username) | Live. Copy-to-clipboard modal — button reads **Copy** → **Copied!** before dismissing |
| Admin panel | Accounts, games, account↔game linking, Orders tab, status control (active/banned/recovering), recovery-email fields, code access log |
| Encryption | AES-256-GCM at rest for password + Guard `shared_secret`; decrypt only server-side |
| Rate limiting | **Live and verified.** Per-order 20 weighted/15min (primary), per-IP 300 weighted/15min (backstop), failed attempts weighted 3×. Fails open on DB error |
| Public `/terms` | Live, linked from lookup footer. Support = Shopee chat |
| Branding | GameShare "Loop Controller" logo (site + favicon + `brand/` exports), violet/magenta theme |
| Database | Supabase, migrations 0001–0004 **all applied**. 6 tables live |
| Deploy | Auto-deploys on every push to `master`. Repo public (required for Vercel Hobby git deploys) |

### Rate-limiter escape hatches
- `x-api-secret` header bypasses the limiter entirely and records no counters — use for testing
  against production without polluting a real buyer's bucket.
- `GET`/`DELETE /api/admin/rate-limit?ip=&orderId=` inspects/clears a bucket. Verified working
  (cleared 112 rows in a live test). Gated by `proxy.ts` — needs admin cookie or `x-api-secret`.

---

## ⚠️ Open item 1 — ROTATE THESE CREDENTIALS

On 2026-08-24 a scan found real credential values had been written into `CHECKPOINT.md` (this file)
and `scripts/seed-test-account.mjs`, and pushed **after the repo was made public**. History was
rewritten (`git filter-branch`), refs and reflog purged, `gc --prune=now` run, force-pushed; a
fresh clone now scans clean. Public repos are scraped by credential bots within minutes, so:

- **Supabase DB password** — Supabase → Settings → Database → Reset
- **`DASHBOARD_PASSWORD`** — still a placeholder; change in `.env.local` **and** Vercel env vars.
  Guards the admin panel, which exposes every stored Steam credential.
- **`ssp266`'s Steam password** — change on Steam, then re-run the seed script
  (now takes `SSP266_PASSWORD` as an env var instead of hardcoding it)

**Confirmed clean, never committed:** `.env.local`, Supabase service role key,
`ACCOUNTS_ENCRYPTION_KEY`, `AUTH_SECRET`, `API_SECRET`, Vercel token, `ssp266`'s `shared_secret`.
Only tracked env file is `.env.local.example`, all values blank.

**Rule:** this repo is public. Never write a real credential into any tracked file, docs included.

---

## Other open items

2. **Shopee listing status — the real blocker.** Unresolved since early in the project. The listing
   was delist-only; never determined whether that's new-SSM-seller verification (just wait) or a
   policy flag (category may be banned, which would invalidate the storefront). Only Chaison can
   check Seller Centre → Account Health + Shopee email. **Everything downstream depends on this.**
3. **Refund policy terms** — the 48hr-replacement / 7-day-refund window on the live `/terms` page is
   a drafted placeholder, marked as unconfirmed. Needs Chaison's actual decision.
4. **Shopee Open API integration** — would remove the manual per-sale order-linking step. Requires
   registering as a Shopee Open Platform partner (3–7 days no review, 1–4 weeks with). Deliberately
   *not started* — pointless until item 2 is resolved. Design note: Shopee masks buyer PII, so
   verification keys on `order_sn` + payment status, which the current form already matches.
5. **No pruning on `lookup_attempts`** — grows unbounded. Prune statement is commented in the
   migration; schedule with pg_cron once traffic is real.

---

## Inventory: 1 account

`ssp266` — Escape From Duckov (Steam App ID `3167020`), status `active`.

A second account (Guard linked Jul 2025) was written off 2026-08-24: its login email and password
were lost, and a `.maFile` stores only authenticator secrets, never credentials. `.maFile` deleted
at Chaison's instruction; it was never in the database. A machine-wide search confirmed no other
record of it existed.

> **Lesson, now in the runbook:** a `.maFile` is not a record of an account. Email, password, and
> revocation code must go into the tracker at creation time or the account becomes unrecoverable.

---

## Expansion strategy (agreed 2026-08-25)

**The lever is buyers-per-account, not account count.** Unit economics: ~RM130–145 per account, of
which ~RM100+ is the game; infrastructure is ~RM5.

| Strategy | Accounts | Sales | Cost | Revenue @ RM20 |
|---|---|---|---|---|
| Breadth — many accounts, few buyers | 30 | 90 | ~RM3,900 | RM1,800 (loss) |
| **Depth — few accounts, many buyers** | **10** | **200** | **~RM1,300** | **RM4,000** |

Buyers-per-account has no Steam-imposed ceiling. Steam **Family** membership is capped at 6 — a
different thing entirely, and not the model in use.

### Hard ceilings on account creation
| Constraint | Limit |
|---|---|
| Steam fraud detection | 1–3 accounts/week |
| MCMC prepaid SIM cap (Malaysia, Feb 2026) | 5 lines per telco ≈ 20–25 numbers on one NRIC |
| Accounts per phone number | ~5 (Steam may treat shared-number accounts as one identity) |
| Per-account setup | 30–45 min, manual — **no bulk method exists** |

Scripted account creation is explicitly rejected: it's what fraud detection is built to catch, and
it fails as a linked ban wave across the whole fleet.

### Email at scale — solved
Custom domain + **Cloudflare Email Routing catch-all** (~RM60/yr, forwarding free, ~30 min setup).
Unlimited addresses at zero marginal cost, consumes **no phone numbers** — decisive, since phone
numbers are the scarce resource. Use non-sequential word-based local parts. Lock the destination
inbox down hard: it's the single point of failure for every account's password reset.

---

## Unverified assumptions the model rests on

These are **not** settled. Test before scaling.

1. **Offline mode allows concurrent play by multiple buyers.** Chaison reports buyers play offline,
   making concurrency a non-issue. Research could not verify multi-user simultaneous play on one
   account, or how long before Steam forces re-authentication. If wrong, buyers-per-account has a
   much lower ceiling and the expansion math above changes.
2. **Account lockdown via a "parent" account.** Chaison observed a competitor's sold account with
   parental controls active, blocking account changes. Research could **not** verify how this is
   done on accounts created after Sept 2024, nor whether parental controls block password/email
   changes (the things that actually matter). Working hypothesis: seller keeps a separate parent
   account, adds each selling account to its family as a supervised member, applies restrictions
   there. Would mean 5 selling accounts per parent → 6 parents for 30 accounts.
   **Fastest test: inspect the competitor account Chaison already bought.**
3. **Steam Desktop Authenticator still links new accounts.** SDA is unmaintained (last release Oct
   2023) with reports of a Mar 2026 Valve change breaking some flows. It worked for `ssp266`, but
   this is a single point of failure — dry-run on the next account **before** buying more games.
   Fallback candidate: `dyc3/steamguard-cli`.

### Ruled out — do not revisit
- **Regional/currency arbitrage** (buying games in cheaper countries). Requires falsifying
  payment-issuance country and billing address; explicitly prohibited by the Subscriber Agreement,
  rated Very High enforcement risk at commercial scale, and thin-to-negative margin for Malaysia.
  Raised repeatedly; the answer has not changed. `research/2026-08-19-steam-regional-pricing-currency-arbitrage.md`
- **Family View as account protection.** Legacy, likely absent on new accounts, PIN is 4 digits with
  a public brute-forcer, and it doesn't block password/email/Guard changes anyway. Better controls:
  never save a payment method, keep wallet at zero, withhold `identity_secret` (already the case —
  only `shared_secret` is stored), monitor the account email for Steam security notices.
  `docs/family-view-lockdown.md`
- **Steam Families as the sharing mechanism.** 6-member cap, requires each buyer to own a separate
  account, undocumented "same household" check, 1-year slot cooldown, and enforces
  one-borrower-at-a-time concurrency. Structurally incompatible with reselling shared access.

---

## Accepted risks (settled — not open questions)
- Retaining a Guard authenticator to serve non-owning buyers very likely violates the Steam
  Subscriber Agreement. Conscious decision, 2026-08-19 (`decisions/log.md`).
- Shopee's prohibited-items policy does not confirm this listing category is allowed. Chaison has
  chosen to proceed regardless — but see open item 2, which is a *factual* question still worth
  answering.
