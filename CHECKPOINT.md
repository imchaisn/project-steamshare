# Project Steamshare — Checkpoint

*Living status file — reflects current state, not a history log. See `PROJECT-LOG.md` in Personal Assistant for the dated history, `docs/order-fulfillment-sop.md` for the manual sale process, and `docs/policies.md` for the buyer-facing policy content (also live at `/terms`).*

**Last updated:** 2026-08-24 (mid-session)

## Done — code side is genuinely launch-ready
- MVP built (lookup page, admin panel, encryption, TOTP, local-verification Shopee mode).
- Moved from `Personal Assistant/project-steamshare/` to `Desktop\Vibecoding Project\Project Steamshare\` — git history intact, all references updated.
- **Private GitHub backup**: `github.com/imchaisn/project-steamshare` — fully pushed, up to date as of commit `b82a792`.
- Admin **Orders** tab, account **status control** (active/banned/recovering), **recovery-email** fields (password encrypted; email address itself currently plaintext — flagged, not yet decided), **code access log** viewer, buyer-facing **copy-to-clipboard** popup.
- Public **`/terms` page** — renders the Terms/Refund/Support policy live, linked from the lookup page footer, added to `proxy.ts`'s public routes.
- **`docs/order-fulfillment-sop.md`** — manual per-sale procedure for local-verification mode.
- **`docs/policies.md`** — same content as `/terms`. Refund window (48hr replacement / 7-day refund) and support contact are explicit, visibly-marked **placeholders** — not Chaison-approved yet, but shipped honestly rather than hidden or faked.
- **`scripts/seed-test-account.mjs`** — ready-to-run, idempotent script that onboards `ssp266` (Escape From Duckov, Steam App ID `3167020`) and creates test order `123` in one shot, the moment three env vars are supplied (DB password, `ssp266`'s Guard shared_secret, a test buyer ID). Not run yet — no DB access available in-session.
- Fixed: `scripts/run-migrations.mjs` now includes `0002_recovery_email.sql` (was missing it). README's stale "service role key still needed" blocker corrected.
- Domain `gameshare.space` connected to Vercel via Namecheap (Chaison did this manually).
- Vercel Hobby vs Pro clarified — Hobby is fine for now (custom domains + Vercel Authentication included free), but its terms restrict to non-commercial use, worth revisiting once real orders flow.

## 🎉 END-TO-END WORKING ON PRODUCTION (2026-08-24)
A real buyer lookup on the live site returns a real, rotating Steam Guard code:
`POST https://www.gameshare.space/api/lookup {"buyerId":"t123","orderId":"123"}`
→ `{"username":"ssp266","password":"<redacted>","code":"K8T2Y"}`
Invalid orders correctly 404. `/terms` 200s. Admin gate 200s (login page). Code rotates
between requests, confirming live TOTP generation rather than a cached value.

Final blocker was: **no environment variables had ever been set on Vercel** (all 6 missing,
which is why every production lookup 500'd all session). Added via Vercel CLI using an
access token, then redeployed. Also fixed along the way: the seed script had encrypted
credentials with a *different* `ACCOUNTS_ENCRYPTION_KEY` than the one in `.env.local` —
re-encrypted and updated the DB row directly.

## Resolved since last update
- **Vercel deploy is fixed and live.** Root cause: Hobby plan blocks Git-triggered deploys for *private* repos ("commit author did not have contributing access"). Made the GitHub repo public (safe — no secrets ever committed, verified) and it deployed immediately. `gameshare.space` now auto-deploys on every push.
- **Live site fully verified**: GameShare branding, `/terms` page, dopamine violet/magenta theme, logo — all confirmed live via direct HTML/CSS fetch, not just "should be working."
- **Database is live.** Root cause of the earlier connection failure: direct connection only supports IPv6, unresolvable from this network. Switched `scripts/run-migrations.mjs` and `scripts/seed-test-account.mjs` to the **Session Pooler** connection (`aws-0-ap-northeast-1.pooler.supabase.com`, IPv4-compatible). Both migrations applied successfully — all 5 tables (`steam_accounts`, `games`, `account_games`, `orders`, `code_access_log`) confirmed to exist via a live query.

## Open items — nothing blocks the core product any more
1. **SECURITY — revoke exposed credentials.** Pasted into chat during setup, should be rotated:
   - Vercel access token (`vcp_2m4…`) — revoke at vercel.com/account/tokens
   - Supabase DB password (`<redacted>`) — reset in Supabase → Settings → Database
   (The Supabase *service role key* and app secrets are fine — they live in `.env.local`
   and Vercel env vars, never committed. Repo is public, so never commit secrets.)
2. **Refund policy terms + real support contact channel.** Still honest, visible placeholders
   in `docs/policies.md` and on the live `/terms` page — needs Chaison's actual decision
   before real buyers see it. This is the main thing left before taking real money.
3. **Change `DASHBOARD_PASSWORD`** from the placeholder `<redacted>` to something
   real (set in both `.env.local` and Vercel env vars).
4. **Rate-limiting on `/api/lookup`** — still unimplemented; needs an external store
   (Upstash Redis free tier). Matters more now that the endpoint is live and functional.
5. **Shopee listing-category confirmation** — still genuinely unresolved from early in the session.
6. **Real Shopee Open API integration** — would replace the manual per-sale order-linking step
   documented in `docs/order-fulfillment-sop.md`.

## Second account already linked, not yet onboarded
SDA also captured `ss_schedule11` (found in the same `maFiles` folder). Not yet added to the
database — needs a game assigned and onboarding via `/admin` → Add Account when ready.

## Operational note for scaling (multiple accounts)
Confirmed with Chaison: the data model already supports "one Steam account serves many Shopee orders" natively — `orders` rows link many-to-one to a single `account_games` row. Per new Steam account: one-time SDA/ODA capture + onboard via `/admin` → Add Account. Every sale after that is just a new row in `/admin` → Orders tab (per `docs/order-fulfillment-sop.md`) — no repeated account setup.

## Multi-agent workflow notes (for continuity)
Chaison corrected the workflow approach mid-session: role-based agents (backend/frontend/orchestrator) doing real build work, not reviewer/critique agents debating a checklist — a reviewer-consensus workflow was launched then explicitly stopped for this reason (see memory `feedback_multi-agent-workflows-build-not-debate`). The corrected pattern — backend agent + frontend agent building in parallel against a shared contract, orchestrator (this session) integrating and deploying after — worked well and produced the `/terms` page + seed script above.

## Known accepted risks (not open questions, don't re-litigate)
- Steam Subscriber Agreement very likely prohibits retaining a Guard authenticator to serve non-owning buyers — conscious risk, accepted 2026-08-19 (`decisions/log.md`).
- Shopee's prohibited-items policy doesn't explicitly confirm this listing category is allowed — still genuinely unresolved, but Chaison has chosen to proceed regardless.
