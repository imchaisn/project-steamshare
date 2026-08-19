# Project Steamshare

**Description:** Shopee-connected shared-Steam-account business. Buy one game on one Steam account, sell standalone access to that same account to many Shopee buyers, each paying roughly game price. A website resolves Shopee buyer ID + order ID → the account's current Steam Guard 2FA code, since the business retains the mobile authenticator permanently and buyers never get full account takeover.
**Status:** Planning — design spec approved, implementation plan in progress
**Key dates:** None specified
**Working folder:** `Personal Assistant/project-steamshare/` (this folder) for docs/tracking. Deliberately placed inside the Personal Assistant workspace, not the top-level `projects/` folder, so Ava's context includes it. Application code (Next.js + Supabase, standalone — not inside `personal-os/`) will live here or in a nested repo once implementation starts.

## Design

Full spec: `docs/superpowers/specs/2026-08-19-project-steamshare-design.md` (repo root)

## Research

- `research/2026-08-19-steam-guard-authenticator-hosting.md` — Guard authenticator hosting mechanics, security, ToS risk
- `research/2026-08-19-steam-regional-pricing-currency-arbitrage.md` — regional pricing/currency arbitrage investigated and **ruled out**: thin-to-negative margin for Malaysia after VPN/payment costs, real enforcement risk. Not part of the business model.

## Known Risk

Retaining a Steam account's Guard authenticator to serve codes to non-owning buyers is very likely a Steam Subscriber Agreement violation — documented enforcement includes 15-day trade/market locks and account suspension risk. No durable, publicly known legitimate operator does this at scale, especially not in Malaysia/SEA. This is a conscious business-risk decision made 2026-08-19, not a technical unknown. See `decisions/log.md` (repo root).

Concurrency (two buyers of the same shared account wanting to play at once) is explicitly unsolved in the MVP — accepted risk, revisit if complaint volume becomes real.

## Next Step

Spec approved by Chaison (2026-08-19). Writing the implementation plan next, then executing via a multi-agent build (backend/frontend/planner subagents + orchestrator, reporting to Ava).
