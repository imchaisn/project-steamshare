-- ============================================================
-- 0003_rate_limit.sql
-- Project Steamshare — IP rate limiting for /api/lookup
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

-- ── lookup_attempts ──────────────────────────────────────────
-- Every /api/lookup attempt, successful or not. `code_access_log`
-- only records codes that were actually served, so it can't see a
-- brute-force sweep of wrong order ids — which is exactly the shape
-- of the attack this table defends against. Kept separate from the
-- audit log so pruning old rows here never touches the audit trail.
create table lookup_attempts (
  id          uuid        primary key default uuid_generate_v4(),
  ip          text        not null,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
-- Supports the only query run against this table:
-- "attempts from this ip since <cutoff>".
create index lookup_attempts_ip_idx on lookup_attempts (ip, created_at desc);

-- ── Row Level Security ────────────────────────────────────────
-- Deny-all for authenticated and anon roles. service_role bypasses
-- RLS entirely, so every write goes through createAdminClient().

alter table lookup_attempts enable row level security;

create policy "deny_all"      on lookup_attempts as restrictive for all to authenticated using (false);
create policy "deny_all_anon" on lookup_attempts as restrictive for all to anon          using (false);

-- ── Housekeeping ──────────────────────────────────────────────
-- Rows older than the rate-limit window are dead weight. Nothing
-- prunes them automatically; run this occasionally (or schedule it
-- with pg_cron) once traffic is real:
--   delete from lookup_attempts where created_at < now() - interval '7 days';
