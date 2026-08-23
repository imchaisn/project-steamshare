# Project Steamshare — Checkpoint

*Living status file — reflects current state, not a history log. See `PROJECT-LOG.md` in Personal Assistant for the dated history, and `docs/order-fulfillment-sop.md` / `docs/policies.md` for operational docs.*

**Last updated:** 2026-08-23 (mid-session)

## Done
- MVP built (lookup page, admin panel, encryption, TOTP, local-verification Shopee mode) — from earlier planning phase.
- Moved from `Personal Assistant/project-steamshare/` to `Desktop\Vibecoding Project\Project Steamshare\` — git history intact, all references updated (top-level `CLAUDE.md`, Personal Assistant `CLAUDE.md`, `PROJECT-LOG.md`, this project's `README.md`).
- Private GitHub backup: `github.com/imchaisn/project-steamshare` — pushed, up to date as of the last commit below.
- New features built and verified this session: admin **Orders** tab, account **status control** (active/banned/recovering), **recovery-email** fields (password encrypted, email itself currently plaintext — flagged, not yet decided), **code access log** viewer, buyer-facing **copy-to-clipboard** popup.
- `docs/order-fulfillment-sop.md` — manual per-sale procedure for local-verification mode.
- `docs/policies.md` — Terms/Refund/Support draft. **Refund window and support contact are explicit placeholders**, not Chaison-approved yet.
- Fixed: `scripts/run-migrations.mjs` now includes `0002_recovery_email.sql` (was missing it). README's stale "service role key still needed" blocker corrected.
- Domain `gameshare.space` connected to Vercel via Namecheap (Chaison did this manually).
- Vercel Hobby vs Pro clarified: Hobby supports custom domains + Vercel Authentication toggle, no Pro needed yet — but Hobby's terms restrict to non-commercial use, worth revisiting once real orders flow.

## Blocked — needs Chaison, not more code
1. **Supabase DB password** — to run migrations (`0001_init.sql` + `0002_recovery_email.sql`), still never applied to a live DB. Nothing in the app actually persists yet.
2. **`ssp266` Steam account's Guard `shared_secret`** — have username/password, can't generate login codes without it. Game confirmed: Escape From Duckov, Steam App ID `3167020`.
3. **A test buyer ID** to pair with test order `123`.
4. **Vercel confirmation** — env vars set and Deployment Protection disabled on the live project? Unconfirmed from this side (API access to the Vercel project has been unreliable all session — `list_projects`/`get_project` return empty despite a real deployment existing).
5. **Refund policy terms + support contact channel** — need Chaison's actual decision, currently placeholders in `docs/policies.md` and `app/page.tsx`.

## Not committed yet (as of last check)
`docs/policies.md` and a small `app/page.tsx` edit (support-contact footer line) were uncommitted as of the last audit pass — should be committed+pushed before treating the GitHub backup as complete. *(Verify this is still true before assuming — may have been fixed since.)*

## In progress / next
Chaison corrected the workflow approach mid-session: wants role-based agents (backend, frontend/designer, orchestrator) actually building toward "live," not reviewer agents debating/critiquing. A "3 agents talking to each other, dynamic workflow" reviewer-consensus pattern was launched, then explicitly stopped per that feedback. Next step: relaunch as a build-focused workflow — e.g. one agent commits/pushes pending work, one prepares a ready-to-run seed script (game + account + order) so it executes instantly once the DB password/shared_secret land, one pushes a fresh Vercel deploy of current code — coordinated by a planner/orchestrator, not a critique loop.

## Known accepted risks (not open questions, don't re-litigate)
- Steam Subscriber Agreement very likely prohibits retaining a Guard authenticator to serve non-owning buyers — conscious risk, accepted 2026-08-19 (`decisions/log.md`).
- Shopee's prohibited-items policy doesn't explicitly confirm this listing category is allowed — still genuinely unresolved, but Chaison has chosen to proceed regardless.
