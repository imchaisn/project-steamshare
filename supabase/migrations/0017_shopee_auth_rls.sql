-- ============================================================
-- 0017_shopee_auth_rls.sql
-- Project Steamshare — deny-all RLS on the two tables 0006 left open
-- Run via: Supabase dashboard → SQL editor, or
--          DB_PASSWORD=... node scripts/run-migrations.mjs 0017
-- ============================================================
--
-- WHY. 0006 created shopee_auth and shopee_push_log without enabling Row
-- Level Security. Every other table follows 0001_init.sql's deny-all
-- convention. The app never notices the difference, because all of its access
-- goes through the service-role client, which bypasses RLS. But with RLS off,
-- anyone holding the project's anon/publishable key can read and write these
-- tables through the Data API, and the project URL is in the public README.
--
--   shopee_push_log  holds the order_sn of every order Shopee has pushed. An
--                    order_sn alone is enough for /api/lookup to return that
--                    order's Steam password and a live Guard code, so this
--                    table is effectively a list of keys to the whole fleet.
--   shopee_auth      holds the shop's Shopee tokens. They are AES-256-GCM
--                    encrypted, so reading them is not directly useful, but an
--                    anon DELETE or a junk INSERT stops every fulfilment call
--                    (getStoredShopToken() reads one unordered row).
--
-- SAFE FOR THE APP: no code path reads these tables with anything but the
-- service-role client. Nothing in the app changes behaviour.
--
-- SAFE TO RE-RUN: enabling RLS twice is a no-op, and the policies are
-- dropped before they are created (same pattern as 0007).
--
-- CHECK IT TOOK. Both rows must show relrowsecurity = true afterwards:
--   select relname, relrowsecurity from pg_class
--   where relname in ('shopee_auth', 'shopee_push_log');
-- lib/migrations-rls.test.ts checks that every table has RLS in SOME
-- migration file; only this query proves it is on in production.

alter table shopee_auth     enable row level security;
alter table shopee_push_log enable row level security;

drop policy if exists "deny_all"      on shopee_auth;
drop policy if exists "deny_all_anon" on shopee_auth;
drop policy if exists "deny_all"      on shopee_push_log;
drop policy if exists "deny_all_anon" on shopee_push_log;

create policy "deny_all"      on shopee_auth     as restrictive for all to authenticated using (false);
create policy "deny_all_anon" on shopee_auth     as restrictive for all to anon          using (false);
create policy "deny_all"      on shopee_push_log as restrictive for all to authenticated using (false);
create policy "deny_all_anon" on shopee_push_log as restrictive for all to anon          using (false);
