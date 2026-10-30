-- ============================================================
-- 0016_order_games_pricing.sql
-- Project Steamshare — record what the buyer paid, per game line
-- Run via: Supabase dashboard → SQL editor, or
--          DB_PASSWORD=... node scripts/run-migrations.mjs 0016
-- ============================================================
--
-- DEPENDS ON 0014 (order_games). Hard guard below.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
--
-- order_games knows WHICH listing sold (shopee_item_id / shopee_model_id) but
-- not AT WHAT PRICE, and `orders` has no price at all. So "which listing sold
-- what, when, and after which change" could not be answered, and every title,
-- voucher or ad experiment was guesswork (.claude/skills/ss-market/SKILL.md §5).
-- Shopee already sends the prices on the item_list entries the webhook parses;
-- this only gives them somewhere to land. See lib/order-pricing.ts for the
-- field sources.
--
-- ── DEPLOY ORDER DOES NOT MATTER ──────────────────────────────────────────
--
-- Code that writes these columns may reach production before this SQL is run.
-- lib/order-pricing.ts isMissingPricingColumns() recognises the missing-column
-- error and fulfillOrder() retries the insert without pricing, so orders keep
-- working and simply record no price until this is applied.
--
-- ── NO BACKFILL ───────────────────────────────────────────────────────────
--
-- Existing rows stay NULL. Their prices are not in our database, and fetching
-- them again means one get_order_detail call per historical order, which is
-- rate-limited and may fall outside Shopee's retention. NULL means "unknown",
-- so reports must exclude NULL rows, never treat them as RM0.

-- ── Guard: 0014 must be applied first ────────────────────────────────────
do $$
begin
  if to_regclass('public.order_games') is null then
    raise exception
      'table order_games does not exist — apply migration 0014 before 0016';
  end if;
end $$;

-- numeric, not float: these are money, and float rounding would make
-- RM2.89 × n sums drift. (12,2) matches MYR's two decimal places.
--
-- ALL NULLABLE. A NULL price is expected and correct for: rows created before
-- this migration, manual/admin rows, bundle-deal items (Shopee sends 0, which
-- the code stores as NULL — see THE ZERO RULE in lib/order-pricing.ts), and
-- any order where Shopee omitted the field.
alter table order_games
  add column if not exists shopee_original_price   numeric(12,2),
  add column if not exists shopee_discounted_price numeric(12,2),
  add column if not exists shopee_quantity         integer;

comment on column order_games.shopee_original_price is
  'Shopee model_original_price (listing price before discount, MYR). NULL = unknown.';
comment on column order_games.shopee_discounted_price is
  'Shopee model_discounted_price (price charged, MYR). NULL = unknown, including bundle-deal items, for which Shopee returns 0.';
comment on column order_games.shopee_quantity is
  'Shopee model_quantity_purchased for this line. NULL = unknown.';

-- ── Shape guard ───────────────────────────────────────────────────────────
-- Refuse 0 and negatives at write time: the code maps them to NULL, so a 0
-- reaching the table means that mapping was bypassed. NULL passes a CHECK on
-- purpose (a CHECK that evaluates to NULL is accepted), which is what keeps
-- every "unknown" case above insertable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_games_shopee_pricing_positive'
      and conrelid = 'public.order_games'::regclass
  ) then
    alter table order_games add constraint order_games_shopee_pricing_positive check (
      shopee_original_price > 0
      and shopee_discounted_price > 0
      and shopee_quantity > 0
    );
  end if;
end $$;
