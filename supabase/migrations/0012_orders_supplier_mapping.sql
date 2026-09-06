-- ============================================================
-- 0012_orders_supplier_mapping.sql
-- Project Steamshare — map OUR order id to the other website's order id
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- INDEPENDENT of 0009, 0010 and 0011 — it only adds nullable columns to
-- `orders` and can be applied in any order relative to them. It is, however,
-- only USEFUL alongside 0011, which is what teaches the lookup route how to
-- fetch a code from a supplier at all.
--
-- WHY THIS EXISTS
--
-- All of these websites are ours. A buyer purchases on the GameShare store and
-- receives a GameShare order id; the same underlying Steam account is also
-- reachable through another of our sites, which knows it by a DIFFERENT order
-- id. The Steam username and password are identical across both — the ONLY
-- thing that differs per website is the order id.
--
-- So the connection we actually want is the direct one:
--
--     our order id  ->  (other website, that website's order id)
--
-- and the username comes from the account the order already resolves to.
--
-- 0011 attached the supplier order id to the ACCOUNT instead. That still works
-- and is kept as a default (see below), but it is the wrong primary: it forces
-- every buyer of one account through a single supplier order, and it cannot
-- express a sale that must point at a specific order on the other site. An
-- explicit per-order link is what makes the connection unambiguous, which is
-- the whole point — there is nothing to infer and therefore nothing to infer
-- wrongly.

alter table orders add column if not exists supplier_site     text;
alter table orders add column if not exists supplier_order_id text;

-- ── Resolution order, implemented in app/api/lookup/route.ts ──
--
--   1. orders.supplier_order_id      <- THE mapping. Authoritative when set.
--   2. steam_accounts.supplier_order_id  <- default for orders that have none
--   3. steam_accounts.shared_secret_enc  <- our own Guard seed, minted offline
--
-- Step 2 exists because the automated Shopee pipeline inserts `orders` rows
-- with no human in the loop (see lib/fulfillment.ts). Without a fallback,
-- every auto-fulfilled order would arrive unmapped and serve nothing. With it,
-- an account can carry a sensible default while any individual order is still
-- free to override it.
--
-- NO CHECK CONSTRAINT pinning the site vocabulary, for the reason 0008 and
-- 0011 both record: a guessed enum in SQL makes a production insert fail on a
-- value that is merely spelled differently. The allowlist lives in TypeScript
-- (lib/code-source/types.ts), next to the adapters that give it meaning.
--
-- Both columns are nullable and default null, so every existing row keeps
-- behaving exactly as it does today. Nothing is backfilled.

-- ── Shape guard ──
-- Mirrors 0011's steam_accounts_code_source_shape, for the same hazard. A site
-- with no order id (or an order id with no site) is a half-filled link: it
-- resolves to nothing, and the lookup layer must then decide what to do with a
-- fragment. Refusing it at write time means that decision never has to be made
-- at all, and an operator finds out in /admin rather than a buyer finding out
-- as a 503.
-- COALESCE IS LOAD-BEARING, not defensive noise. Without it this constraint
-- silently fails to do its job: length(btrim(NULL)) is NULL, TRUE AND NULL is
-- NULL, FALSE OR NULL is NULL, and Postgres accepts a CHECK unless it evaluates
-- to FALSE. So ('cyberspace.cyou', NULL) -- a site with no order id, precisely
-- the half-filled link this guard exists to refuse -- would insert cleanly.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_supplier_mapping_shape'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table orders add constraint orders_supplier_mapping_shape check (
      (supplier_site is null and supplier_order_id is null)
      or
      (supplier_site is not null
       and coalesce(length(btrim(supplier_order_id)), 0) > 0)
    );
  end if;
end $$;

-- Supports the admin Orders view filtering to "orders mapped to a website".
-- Partial, because mapped orders are the minority and the unmapped majority
-- must not bloat the index.
create index if not exists orders_supplier_idx
  on orders (supplier_site, supplier_order_id)
  where supplier_order_id is not null;
