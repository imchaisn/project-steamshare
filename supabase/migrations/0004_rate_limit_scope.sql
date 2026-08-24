-- ============================================================
-- 0004_rate_limit_scope.sql
-- Project Steamshare — scope + outcome for /api/lookup rate limiting
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

-- 0003 rate limited on IP alone. Our buyers are Malaysian and Malaysian
-- mobile carriers use CGNAT heavily, so many unrelated buyers share one
-- public IP — a tight per-IP cap locks out paying customers. The limiter
-- now keys primarily on the ORDER ID (which is per-buyer) and weights
-- FAILED attempts heavier than successful ones, since a burst of 404s
-- against unknown order ids is the actual brute-force signal. Per-IP
-- stays as a high backstop. See lib/rate-limit.ts for the numbers.

-- ── lookup_attempts: new columns ─────────────────────────────
-- order_id: normalized (trimmed, lowercased, truncated) order id the
--   attempt was made against. Null when the request was malformed and
--   carried no usable order id — such rows count against the IP only.
-- outcome:  success | unavailable | failure | blocked
--   success     — order verified, code served.
--   unavailable — order verified but the account is banned/recovering.
--                 A real buyer hitting an ops problem, not an attacker.
--   failure     — order/username did not resolve, or malformed request.
--   blocked     — the limiter itself rejected the attempt.
--   'unknown'   — default, carried by rows written before this migration.
-- Deliberately a plain text column with no CHECK constraint, matching
-- steam_accounts.status; the app is the only writer (service role only).
alter table lookup_attempts add column if not exists order_id text;
alter table lookup_attempts add column if not exists outcome  text not null default 'unknown';

-- ── Indexes ───────────────────────────────────────────────────
-- Supports the per-order query: "attempts against this order id since
-- <cutoff>". The per-IP equivalent is already covered by
-- lookup_attempts_ip_idx from 0003.
create index if not exists lookup_attempts_order_idx
  on lookup_attempts (order_id, created_at desc);

-- ── Row Level Security ────────────────────────────────────────
-- Already enabled in 0003; re-asserted here so this file is complete and
-- self-describing. Deny-all for authenticated and anon roles.
-- service_role bypasses RLS entirely, so every write goes through
-- createAdminClient().

alter table lookup_attempts enable row level security;

drop policy if exists "deny_all"      on lookup_attempts;
drop policy if exists "deny_all_anon" on lookup_attempts;

create policy "deny_all"      on lookup_attempts as restrictive for all to authenticated using (false);
create policy "deny_all_anon" on lookup_attempts as restrictive for all to anon          using (false);

-- ── Housekeeping ──────────────────────────────────────────────
-- Rows older than the longest rate-limit window are dead weight. Nothing
-- prunes them automatically; run this occasionally (or schedule it with
-- pg_cron) once traffic is real:
--   delete from lookup_attempts where created_at < now() - interval '7 days';
