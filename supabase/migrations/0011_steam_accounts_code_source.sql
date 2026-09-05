-- ============================================================
-- 0011_steam_accounts_code_source.sql
-- Project Steamshare — second code source: supplier-hosted Guard codes
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- INDEPENDENT OF 0009. 0009 (orders follow-up columns) is written but not
-- applied at the time of writing; this migration touches a different table
-- and must not wait on it. It can be applied before or after 0009.
--
-- WHY THIS EXISTS
--
-- Until now every sellable account was one we hold the Steam Guard seed for,
-- so app/api/lookup/route.ts could always mint a code offline from
-- shared_secret_enc: no network, infinite codes, no expiry, microsecond
-- latency. Accounts bought from third-party suppliers have no seed we own —
-- their Guard code lives on the supplier's own portal (cyberspace.cyou,
-- gamersfantasy.my) and must be fetched over HTTP.
--
-- 0001 declared shared_secret_enc NOT NULL, so such an account could not
-- previously be represented in this database AT ALL. That is what makes this
-- a schema change rather than an application change.

alter table steam_accounts
  add column if not exists code_source       text not null default 'totp',
  add column if not exists supplier_site     text,
  add column if not exists supplier_order_id text;

-- Every one of the 7 existing accounts is a TOTP account, and the default
-- above already says so. No backfill step, and therefore no window in which a
-- live account is misrouted to a supplier it has no configuration for.

alter table steam_accounts alter column shared_secret_enc drop not null;

-- ── The shape guard ───────────────────────────────────────────
-- This CHECK is the point of the migration, not decoration.
--
-- Dropping the NOT NULL above opens a hole: a row could be written with
-- code_source 'totp' and no seed. Such a row passes EVERY check in the lookup
-- route — order verified, username matched, status active — and only then
-- throws at code generation. That is the worst possible place to fail: the
-- buyer has already paid, already proven entitlement, and gets a 500 that
-- tells them nothing. Refuse the bad state at write time instead.
--
-- NOT NULL is not enough on the supplier side: an empty or whitespace-only
-- supplier_order_id satisfies a NOT NULL test and then dead-ends at the portal,
-- producing a 503 for a paying buyer from a row that looked correctly
-- configured in /admin. length(btrim(...)) > 0 refuses that at write time too.
--
-- Wrapped in a guard so the migration is safely re-runnable: ADD CONSTRAINT has
-- no IF NOT EXISTS form in Postgres.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'steam_accounts_code_source_shape'
      and conrelid = 'public.steam_accounts'::regclass
  ) then
    alter table steam_accounts add constraint steam_accounts_code_source_shape check (
      (code_source = 'totp'     and shared_secret_enc is not null)
      or
      (code_source = 'supplier' and supplier_site is not null
                                and length(btrim(supplier_order_id)) > 0)
    );
  end if;
end $$;

-- DELIBERATELY NO check constraint pinning the code_source or supplier_site
-- vocabulary. 0008 learned this the hard way and wrote it down: pinning a
-- guessed enum in SQL makes a production insert fail on a value that is
-- merely spelled differently. The vocabulary is enforced in TypeScript
-- (lib/code-source/types.ts), where it changes in the same commit as the code
-- that reads it. The CHECK above constrains SHAPE, which is a real invariant,
-- not spelling, which is not.

-- ── Index: supplier accounts ──────────────────────────────────
-- Supports the admin panel's "show me every supplier account and its order
-- id" read. Partial on code_source = 'supplier' because supplier accounts are
-- the small minority; the TOTP majority must not bloat this index.
create index if not exists steam_accounts_supplier_idx
  on steam_accounts (supplier_site, supplier_order_id)
  where code_source = 'supplier';
