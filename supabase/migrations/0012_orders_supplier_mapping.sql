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

-- Supports the admin Orders view filtering to "orders mapped to a website".
-- Partial, because mapped orders are the minority and the unmapped majority
-- must not bloat the index.
create index if not exists orders_supplier_idx
  on orders (supplier_site, supplier_order_id)
  where supplier_order_id is not null;
