-- ============================================================
-- 0014_order_games.sql
-- Project Steamshare — one order may carry MORE THAN ONE game
-- Run via: Supabase dashboard → SQL editor, or
--          DB_PASSWORD=... node scripts/run-migrations.mjs 0014
-- ============================================================
--
-- DEPENDS ON 0005 (unique index on orders.shopee_order_id) and 0012
-- (orders.supplier_site / supplier_order_id, whose values this backfills).
-- Both are applied in production as of 2026-09-06. There is a hard guard for
-- 0005 below, because this migration's whole premise is that `orders` stays
-- ONE row per Shopee order.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
--
-- Shopee splits a cart by SHOP, not by item. A buyer who checks out four
-- different games from our shop in one go produces ONE order_sn carrying four
-- entries in item_list — not four order ids. Until now the pipeline mapped
-- only the FIRST item that resolved to a game (mapItemsToGame in
-- lib/fulfillment.ts) and silently discarded the rest: the buyer paid for
-- four games, got one, and nothing in the logs said otherwise, because the
-- fulfilment status was `created`, not `no_mapping`. The reconciliation
-- script had the same blind spot (`items.some(...)`).
--
-- ── WHY A CHILD TABLE, AND NOT MORE `orders` ROWS ─────────────────────────
--
-- The obvious alternative — one `orders` row per game, sharing a
-- shopee_order_id — is EXACTLY the shape migration 0005 exists to forbid.
-- verifyShopeeOrder() reads shopee_order_id with .maybeSingle(), which errors
-- on multiple matches, so two rows for one order id permanently break that
-- buyer's lookup. That happened for real on 2026-08-26 (order ssp123) and
-- 0005's unique index is the fix. Relaxing it to
-- unique(shopee_order_id, game_id) would reintroduce the exact failure mode,
-- because .maybeSingle() would still be reading shopee_order_id alone.
--
-- So: `orders` stays strictly one row per Shopee order, 0005 is untouched,
-- and the one-to-many lives here.
--
-- ── WHAT MOVES HERE, AND WHAT DELIBERATELY DOES NOT ───────────────────────
--
-- MOVES (because it is genuinely per-game):
--   account_game_id    — each game is allocated its own Steam account
--   supplier_site      — game A may come from gamersfantasy.my and game B
--   supplier_order_id    from cyberspace.cyou, IN THE SAME ORDER. This is the
--                        single strongest argument for the child table.
--   delivered_at       — Chaison's call 2026-09-06: ONE CHAT MESSAGE PER
--   delivery_error       GAME. The exactly-once latch must therefore be
--   delivery_attempts    per-game, so one failed send cannot block the others.
--
-- STAYS ON `orders` (per-order, not per-game):
--   verified, shopee_order_id, buyer_username, source, shipped_at, follow-up.
--
-- ── THE LEGACY MIRROR ─────────────────────────────────────────────────────
--
-- orders.account_game_id / supplier_site / supplier_order_id are NOT dropped.
-- They are kept as a MIRROR OF THE FIRST GAME (position 0), written by the
-- same code that writes these rows, because the admin panel still reads them.
-- `order_games` is authoritative for the buyer lookup, for delivery, and for
-- account load counting. Nothing may write the mirror without writing here.
-- Dropping the columns is a follow-up, once the admin panel is multi-game.

-- ── Guard: 0005 must be applied first ────────────────────────────────────
-- Without the single-column unique index, `orders` can already hold more than
-- one row per shopee_order_id, and backfilling one order_games row per orders
-- row would faithfully reproduce that corruption into the new table.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename  = 'orders'
      and indexname  = 'orders_shopee_order_id_key'
  ) then
    raise exception
      'migration 0005 (unique index orders_shopee_order_id_key) is not applied — '
      'apply it before 0014, or this table inherits duplicate orders rows';
  end if;
end $$;

create table if not exists order_games (
  id                uuid        primary key default uuid_generate_v4(),
  order_id          uuid        not null references orders(id) on delete cascade,

  -- Nullable for the same reason orders.account_game_id is: an admin may
  -- create a placeholder row before allocating, and `on delete set null`
  -- must not cascade an account deletion into losing the order line itself.
  account_game_id   uuid        references account_games(id) on delete set null,

  -- Per-game supplier mapping. Same meaning as 0012's columns, same
  -- resolution order (this row's mapping, then the account's default, then
  -- our own Guard seed) — just resolved per game instead of per order.
  supplier_site     text,
  supplier_order_id text,

  -- Per-game delivery bookkeeping. Mirrors 0008's columns on `orders`.
  -- delivered_at is THE LATCH: the claim is a conditional update
  -- (`where id = $1 and delivered_at is null`), so two concurrent Shopee
  -- retries can never both send this game's message.
  delivered_at      timestamptz,
  delivery_error    text,
  delivery_attempts integer     not null default 0,

  -- Shopee provenance, so a retry maps the same line item back to the same
  -- row rather than allocating a second account for a game already served.
  -- Null on manually created rows (the admin panel, and the seed scripts) —
  -- those have no Shopee line item to point at.
  shopee_item_id    bigint,
  shopee_model_id   bigint      not null default 0,

  -- Display order on the buyer's lookup page, so the games appear in the
  -- order Shopee listed them rather than in whatever order Postgres returns.
  -- Position 0 is the game mirrored onto `orders` (see THE LEGACY MIRROR).
  position          integer     not null default 0,

  created_at        timestamptz not null default now()
);

-- ── Idempotency ───────────────────────────────────────────────────────────
-- The webhook dedupe key. Shopee retries a push it considers failed at
-- 300s / 1800s / 10800s, so the same item_list WILL arrive more than once.
--
-- PARTIAL, on `shopee_item_id is not null`, on purpose. Manually created rows
-- carry no Shopee item id, and in Postgres NULLs never collide in a unique
-- index — so without the predicate the index would simply not constrain them,
-- which is fine, but the predicate makes that intent explicit and keeps the
-- index off rows it can never apply to.
create unique index if not exists order_games_shopee_item_key
  on order_games (order_id, shopee_item_id, shopee_model_id)
  where shopee_item_id is not null;

-- The buyer lookup reads every game for one order, in display order. This is
-- the hot path for /api/lookup, so it is the one index that must exist.
create index if not exists order_games_order_idx
  on order_games (order_id, position);

-- ALLOCATION LOAD COUNTING. lib/fulfillment.ts counts how many buyers are
-- already on an account_games row before allocating the next one (the
-- waterfall). That count MUST come from this table now: counting
-- orders.account_game_id would see only the mirrored first game and every
-- additional game in a bulk order would be invisible, silently overfilling
-- accounts past ACCOUNT_MAX_BUYERS.
--
-- This also closes the index gap 0008 left open and lib/fulfillment.ts
-- flagged in a comment: the equivalent count on `orders` was a seq scan.
create index if not exists order_games_account_game_idx
  on order_games (account_game_id);

-- Reconciliation and the resend path: "which game lines are not delivered?"
-- Partial for the same reason 0008's orders_undelivered_idx is — delivered
-- rows are the overwhelming majority and must not bloat the index.
create index if not exists order_games_undelivered_idx
  on order_games (created_at)
  where delivered_at is null;

-- ── Shape guard ───────────────────────────────────────────────────────────
-- Copied verbatim in intent from 0012's orders_supplier_mapping_shape, for
-- the identical hazard: a site with no order id (or an order id with no site)
-- is a half-filled link that resolves to nothing, and the lookup layer would
-- then have to decide what to do with a fragment. Refusing it at write time
-- means that decision never has to be made.
--
-- COALESCE IS LOAD-BEARING, exactly as 0012 records: length(btrim(NULL)) is
-- NULL, TRUE AND NULL is NULL, FALSE OR NULL is NULL, and Postgres accepts a
-- CHECK unless it evaluates to FALSE — so without COALESCE the pair
-- ('cyberspace.cyou', NULL) would insert cleanly, which is precisely the case
-- this guard exists to refuse.
--
-- NO CHECK CONSTRAINT pinning the site vocabulary, for the reason 0008, 0011
-- and 0012 all record: a guessed enum in SQL makes a production insert fail
-- on a value that is merely spelled differently. The allowlist lives in
-- TypeScript (lib/code-source/types.ts), next to the adapters that give it
-- meaning.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_games_supplier_mapping_shape'
      and conrelid = 'public.order_games'::regclass
  ) then
    alter table order_games add constraint order_games_supplier_mapping_shape check (
      (supplier_site is null and supplier_order_id is null)
      or
      (supplier_site is not null
       and coalesce(length(btrim(supplier_order_id)), 0) > 0)
    );
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────────
-- 0001_init.sql establishes deny-all RLS on every table; all server-side
-- access goes through the service-role client, which bypasses it. A new table
-- without RLS enabled would be readable by the anon key — i.e. it would
-- expose which account every order resolves to. Match the house rule.
alter table order_games enable row level security;

-- ── Backfill ──────────────────────────────────────────────────────────────
-- Every existing order becomes a one-game order. This is what keeps the 15
-- live orders (and every test id: t123, thr123, sek123, ssp123, …) working
-- identically the moment the lookup switches to reading this table.
--
-- IDEMPOTENT: `where not exists` means re-running this migration adds
-- nothing. Deliberately NOT keyed on the partial unique index above, because
-- these rows carry no shopee_item_id and so that index does not constrain
-- them.
--
-- delivered_at is carried across so an already-delivered order is not
-- re-messaged by the per-game delivery path the moment it goes live.
insert into order_games (
  order_id, account_game_id, supplier_site, supplier_order_id,
  delivered_at, delivery_error, delivery_attempts, position
)
select
  o.id, o.account_game_id, o.supplier_site, o.supplier_order_id,
  o.delivered_at, o.delivery_error, coalesce(o.delivery_attempts, 0), 0
from orders o
where not exists (select 1 from order_games g where g.order_id = o.id);

-- ── Post-condition ────────────────────────────────────────────────────────
-- Fail loudly rather than leave a half-backfilled table behind. An order with
-- no game line is invisible to the new lookup — it would present to a buyer
-- as "order not found" on an order that works today, which is the single
-- worst outcome this migration could produce.
do $$
declare
  orphan_count int;
begin
  select count(*) into orphan_count
  from orders o
  where not exists (select 1 from order_games g where g.order_id = o.id);

  if orphan_count > 0 then
    raise exception
      '% orders row(s) have no order_games row after backfill — '
      'the buyer lookup would report "order not found" for each of them',
      orphan_count;
  end if;
end $$;
