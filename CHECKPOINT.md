# Project Steamshare — Checkpoint

*Living status file — reflects current state, not a history log. See `PROJECT-LOG.md` in Personal Assistant for the dated history, `docs/order-fulfillment-sop.md` for the manual sale process, and `docs/policies.md` for the buyer-facing policy content (also live at `/terms`).*

**Last updated:** 2026-08-23 (mid-session)

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

## Blocked — needs Chaison, not more code
1. **Trigger the actual Vercel deployment.** New finding: the Vercel MCP connector is now explicitly denied permission ("You don't have permission to create a Production/Preview Deployment") on this project — different from the earlier "can't see the project" issue, which seems resolved. Something changed in project/team permissions, likely around when the domain got connected. **Easiest fix: connect the Vercel project to the GitHub repo (`imchaisn/project-steamshare`) via the dashboard** — gives auto-deploy on every push and sidesteps the API block entirely.
2. **Confirm Vercel env vars are set + Deployment Protection (Vercel Authentication) is off.** Unconfirmed from this side all session.
3. **Supabase DB password.** Nothing persists in a real database yet — this is the single biggest blocker. Once supplied, migrations `0001_init.sql` + `0002_recovery_email.sql` run, then the seed script.
4. **`ssp266`'s Steam Guard `shared_secret`.** Have username (`ssp266`) and password (`<redacted>`), can't generate login codes without this.
5. **A test buyer ID** for order `123`.
6. **Refund policy terms + real support contact channel.** Currently honest, visible placeholders in `docs/policies.md` and the live `/terms` page — needs Chaison's actual decision before real buyers see it.

## Multi-agent workflow notes (for continuity)
Chaison corrected the workflow approach mid-session: role-based agents (backend/frontend/orchestrator) doing real build work, not reviewer/critique agents debating a checklist — a reviewer-consensus workflow was launched then explicitly stopped for this reason (see memory `feedback_multi-agent-workflows-build-not-debate`). The corrected pattern — backend agent + frontend agent building in parallel against a shared contract, orchestrator (this session) integrating and deploying after — worked well and produced the `/terms` page + seed script above.

## Known accepted risks (not open questions, don't re-litigate)
- Steam Subscriber Agreement very likely prohibits retaining a Guard authenticator to serve non-owning buyers — conscious risk, accepted 2026-08-19 (`decisions/log.md`).
- Shopee's prohibited-items policy doesn't explicitly confirm this listing category is allowed — still genuinely unresolved, but Chaison has chosen to proceed regardless.
