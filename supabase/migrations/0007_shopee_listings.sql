-- ============================================================
-- 0007_shopee_listings.sql
-- Project Steamshare — map a Shopee listing (item + variation) to one of our games
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

-- ── shopee_listings ───────────────────────────────────────────
-- The missing link in the automated fulfilment pipeline. A Shopee push only
-- hands us an `ordersn`; v2.order.get_order_detail then tells us which
-- item_id / model_id was bought. Nothing in that payload names one of OUR
-- games — Shopee item names are marketing copy that gets edited constantly
-- ("[FLASH SALE] Elden Ring Shared Account 🔥"), so matching on the item name
-- string would silently break the moment the shop edits a title. This table
-- is the explicit, operator-maintained mapping instead, seeded by
-- scripts/seed-shopee-listings.mjs.
--
-- WHY model_id IS IN THE PRIMARY KEY
-- A Shopee listing (item_id) can carry variations, which Shopee calls
-- *models* (model_id) — e.g. one listing offering "1 month" and "3 months",
-- or a bundle listing offering several different titles as pick-one options.
-- Two models of the same item_id can therefore legitimately need to resolve
-- to two DIFFERENT games. Keying on item_id alone would make that
-- unrepresentable and would quietly hand a buyer the wrong game.
-- Listings with no variations report model_id = 0 in Shopee's order detail,
-- which is why model_id defaults to 0 rather than being nullable: a null
-- would not participate in the primary key uniqueness check, so two rows for
-- the same variation-less item could both be inserted. 0 is a real value and
-- collides properly.
--
-- NOT-KNOWN / DELIBERATELY UNCONSTRAINED
-- We have not confirmed whether Shopee ever reports model_id as absent
-- (rather than 0) for a variation-less item. If lib/shopee-api.ts ever sees
-- a missing model_id it should normalise it to 0 at the boundary, not insert
-- a null here.
create table if not exists shopee_listings (
  item_id     bigint      not null,
  -- bigint, not int: Shopee item ids are already 12+ digits and would
  -- overflow int4. Same reasoning as shopee_auth.shop_id in 0006.
  model_id    bigint      not null default 0,
  game_id     uuid        not null references games(id) on delete restrict,
  -- on delete restrict, NOT cascade: deleting a game while a live Shopee
  -- listing still points at it would leave paid orders unfulfillable with no
  -- trace of why. Better to block the delete and force the operator to
  -- retire the listing mapping first.
  created_at  timestamptz not null default now(),
  primary key (item_id, model_id)
);

-- ── Indexes ───────────────────────────────────────────────────
-- The primary key already covers the hot path (given item_id + model_id,
-- find the game). This index covers the reverse lookup, which is the
-- operator/admin direction: "which Shopee listings sell this game?" — needed
-- when a game is retired or an account fleet runs dry and we want to pause
-- the matching listings. Postgres does not index foreign key columns
-- automatically, so this also keeps the `on delete restrict` check on
-- games and any future join off a sequential scan.
create index if not exists shopee_listings_game_idx on shopee_listings (game_id);

-- ── Row Level Security ────────────────────────────────────────
-- Same deny-all convention as every table in 0001_init.sql: authenticated
-- and anon get nothing, service_role bypasses RLS entirely so all reads and
-- writes go through createAdminClient(). This table is not buyer-facing —
-- it is only ever touched by the webhook fulfilment path and the seed
-- script, both of which run service-role.
alter table shopee_listings enable row level security;

-- `create policy` has no IF NOT EXISTS, so drop-then-create keeps this file
-- safe to re-run after a partial application.
drop policy if exists "deny_all" on shopee_listings;
drop policy if exists "deny_all_anon" on shopee_listings;

create policy "deny_all"      on shopee_listings as restrictive for all to authenticated using (false);
create policy "deny_all_anon" on shopee_listings as restrictive for all to anon          using (false);
