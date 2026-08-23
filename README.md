# Project Steamshare

**Description:** Shopee-connected shared-Steam-account business. Buy one game on one Steam account, sell standalone access to that same account to many Shopee buyers, each paying roughly game price. A website resolves Shopee buyer ID + order ID → the account's current Steam Guard 2FA code, since the business retains the mobile authenticator permanently and buyers never get full account takeover.
**Status:** MVP built and committed. Blocked on (1) Supabase credentials to go live end-to-end, (2) verifying Shopee actually allows this listing category.
**Key dates:** None specified
**Working folder:** `Desktop\Vibecoding Project\Project Steamshare\` (moved 2026-08-23 from `Personal Assistant/project-steamshare/`, matching the standard convention for build/vibecoded projects). Still tracked and reported on from the Personal Assistant workspace — see `Personal Assistant/PROJECT-LOG.md`. Live Next.js 16 + Supabase app (standalone git repo, own Vercel project).

## Build Status (2026-08-19)

Built via a 4-agent pipeline (planner → backend coder → frontend coder → integration check), from a written implementation plan. All 12 planned tasks complete, 16 commits, full `npm run build` passes.

| Piece | Status |
|---|---|
| Project scaffold, DB schema, encryption module, TOTP (Steam Guard code gen), auth/admin gate | ✅ Built, committed, **live-verified** (real crypto tests pass; admin login 401/200/cookie/redirect all confirmed end-to-end) |
| Shopee verification client | ✅ Built, committed — **local-verification mode only** (see Known Risks) |
| Lookup route, admin CRUD routes | ✅ Built, committed, build-verified — not live-tested yet (needs real Supabase DB) |
| Public lookup page, admin login page, admin dashboard | ✅ Built, committed — admin login page live-verified; the other two build-verified only (same DB dependency) |

Supabase project created by Chaison: `https://vwefthulbxqarttytvpl.supabase.co`. Migration runner script added at `scripts/run-migrations.mjs` (adapted from `personal-os`'s script — direct Postgres connection, no interactive `supabase login` needed). **Still needed to go live:** the project's DB password (to run the migration) and service role key (for `.env.local` — the app's own runtime auth, separate from the DB password).

## Design & Planning

- Spec: `docs/superpowers/specs/2026-08-19-project-steamshare-design.md` (repo root)
- Implementation plan: `docs/superpowers/plans/2026-08-19-project-steamshare.md` (repo root) — fully executed. Plan was reviewed by a planner agent before coding started, which caught two real gaps (see Known Risks) and one dead-code nit (`proxy.ts` re-implementing a check `lib/auth.ts` already exported) — all fixed before the backend agent began.

## Research

- `research/2026-08-19-steam-guard-authenticator-hosting.md` — Guard authenticator hosting mechanics, security, ToS risk
- `research/2026-08-19-steam-regional-pricing-currency-arbitrage.md` — regional pricing/currency arbitrage investigated and **ruled out**: thin-to-negative margin for Malaysia after VPN/payment costs, real enforcement risk. Not part of the business model.
- `Personal Assistant/research/2026-08-19-shopee-open-api-integration.md` — Shopee Open Platform registration process, OAuth + HMAC-SHA256 signing, no confirmed sales-history gate for new sellers, buyer PII is masked in API responses (design around `order_sn` + status, not full buyer identity). Realistic timeline: 3–7 days (no review) to 1–4 weeks (with partner review).
- `research/2026-08-19-shopee-multi-account-seller-policy.md` — separate seller account (distinct from a personal buyer account) is a normal, supported path; no published cap on accounts per person, but Shopee links shops via NRIC/phone/bank/SSM and strips new-seller incentives (60-day fee waiver, first 200 orders) from linked shops. **Digital goods (game accounts/keys) are NOT confirmed as an allowed Shopee listing category** — this is unverified, not cleared.

## Known Risks

1. **Steam ToS.** Retaining a Steam account's Guard authenticator to serve codes to non-owning buyers is very likely a Steam Subscriber Agreement violation — documented enforcement includes 15-day trade/market locks and account suspension. No durable, publicly known legitimate operator does this at scale, especially not in Malaysia/SEA. Conscious business-risk decision made 2026-08-19. See `decisions/log.md` (repo root).
2. **Shopee listing category unverified.** Whether game accounts/digital keys are even allowed under Shopee's prohibited/restricted items policy was not confirmed by research either way. This could kill the Shopee-as-storefront angle entirely — worth checking directly with Shopee (Seller Support or the live policy page) before investing further in the Shopee-integration side specifically.
3. **Concurrency unsolved.** Two buyers of the same shared account wanting to play at once — explicitly not handled in the MVP, accepted risk, revisit if complaint volume becomes real.
4. **Local-verification mode, not live Shopee API.** The deployed `verifyShopeeOrder()` checks a local `orders` table, not Shopee's real API (no partner credentials exist yet). Practical effect: **self-serve auto-linking doesn't work yet** — an admin must manually pre-create a verified `orders` row per sale via the Supabase SQL editor. This reverts to the "manual admin linking" alternative that was originally considered and rejected during brainstorming, purely because live Shopee credentials don't exist yet.
5. **No rate-limiting on `/api/lookup`.** The spec called for IP rate-limiting as an enumeration defense; not implemented in the MVP. Matters more than usual right now since local-verification mode has no live Shopee check backstopping a guessed order ID/buyer ID pair. Accepted as an MVP gap rather than shipping an unreliable in-memory limiter (doesn't work reliably across serverless invocations without an external store).

## Blockers — Action Needed From Chaison

1. **Supabase DB password** (Dashboard → Settings → Database → Connection string) — to run `scripts/run-migrations.mjs` and actually create the tables.
2. ~~Supabase service role key~~ — provided 2026-08-20, already in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`.
3. **Verify Shopee's prohibited-items policy** allows selling shared game-account access before building further on the Shopee side.
4. **Shopee Open Platform registration** (free, self-serve start) — needed for real order verification to replace local-verification mode.

## Next Step

Once the two Supabase values land: run the migration, seed one test account/game/order, and do a real end-to-end lookup test (not just build checks). In parallel, resolve the Shopee listing-category question, since it affects whether this business can operate as designed at all.
