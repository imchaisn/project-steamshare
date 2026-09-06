-- ============================================================
-- 0010_orders_auto_ship.sql
-- Project Steamshare — orders columns for the automated Shopee "mark as
-- shipped" step
-- Run via: Supabase dashboard → SQL editor, or scripts/run-migrations.mjs 0010
-- ============================================================
--
-- DEPENDS ON 0008_orders_auto_delivery.sql. This reuses the exact same
-- exactly-once pattern as `delivered_at` (see lib/shopee-logistics.ts and the
-- shipOnce() latch in app/api/webhooks/shopee/route.ts) and the same
-- `source = 'shopee_push'` gate, both of which 0008 introduces.
--
-- WHAT THIS IS FOR
-- Until this migration, nothing in this codebase ever called Shopee's
-- shipping API. Every auto-fulfilled order sat in Shopee's own READY_TO_SHIP
-- status forever, which risks Shopee's Auto Cancellation (refund to the
-- buyer) even though the buyer had already been sent working Steam
-- credentials in chat — a direct, recurring revenue leak, not a rare edge
-- case. See research/2026-09-06-shopee-virtual-goods-shipping-requirement.md
-- for the sourced policy detail. This adds the columns the new automated
-- "ship it too" step needs to run safely and exactly once per order.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'delivered_at'
  ) then
    raise exception 'ABORTED: orders has no delivered_at column. Apply supabase/migrations/0008_orders_auto_delivery.sql FIRST — auto-ship reuses that migration''s source column and idempotency pattern.';
  end if;
end $$;

-- ── New columns ───────────────────────────────────────────────
-- All `if not exists` so a run that died partway can simply be re-run.

-- Set when Shopee accepted the ship_order call for this order. This is the
-- idempotency latch: non-null means DO NOT call ship_order again. Claimed
-- with a conditional update (`where id = $1 and shipped_at is null`), same
-- protocol as delivered_at.
alter table orders add column if not exists shipped_at timestamptz;

-- Last failure reason from the ship attempt. Free text — the useful part is
-- almost always Shopee's own error string (e.g. a wrong non_integrated
-- parameter, or "logistic status not ready to ship").
alter table orders add column if not exists ship_error text;

-- Incremented on each claim, mirroring delivery_attempts, so a permanently
-- unshippable order (bad shop auth, a listing whose logistics channel turns
-- out not to be non-integrated) is visible rather than retried forever by a
-- future reconciliation job.
alter table orders add column if not exists ship_attempts int not null default 0;

-- ── Index: shipped orders still awaiting a "ship" call ────────
-- Same shape as 0008's orders_undelivered_idx. No reconciliation job reads
-- this yet (none is built as of this migration — see CHECKPOINT.md), but the
-- index is cheap to have in place before one is, and mirrors the existing
-- pattern exactly so a future job's query needs no schema change.
create index if not exists orders_unshipped_idx
  on orders (created_at)
  where shipped_at is null;
