-- ============================================================
-- 0009_orders_follow_up.sql
-- Project Steamshare — orders columns for the delayed post-delivery follow-up
-- Run via: Supabase dashboard → SQL editor, or scripts/run-migrations.mjs 0009
-- ============================================================
--
-- DEPENDS ON 0008_orders_auto_delivery.sql. The follow-up is defined entirely
-- in terms of `delivered_at` — "24 hours after the buyer got their
-- credentials" — so on a database without 0008 this migration would create
-- columns that can never be populated by a query that can never run.
--
-- WHAT THIS IS FOR
-- A day after the automated delivery message, the buyer gets one more chat
-- message asking them to press "Order Received" and leave a rating. See
-- lib/follow-up.ts for the message and the exactly-once protocol, and
-- docs/order-fulfillment-sop.md for the copy and why it is worded that way.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD
-- No buyer-id column. The follow-up job re-reads buyer_user_id from Shopee's
-- get_order_detail at send time instead. Storing it would have meant adding a
-- column write to the fulfilment INSERT — i.e. putting a schema dependency in
-- the money path, where a deploy landing ahead of its migration turns a paid
-- order into a 500 and a Shopee retry storm. The follow-up is a nice-to-have;
-- it is not allowed to carry that risk. One extra API call on a daily batch of
-- a handful of orders is the cheaper side of that trade.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'delivered_at'
  ) then
    raise exception 'ABORTED: orders has no delivered_at column. Apply supabase/migrations/0008_orders_auto_delivery.sql FIRST — the follow-up window is measured from delivered_at, so without it every column this migration adds is dead weight.';
  end if;
end $$;

-- ── New columns ───────────────────────────────────────────────
-- All `if not exists` so a run that died partway can simply be re-run.

-- Set when the follow-up message was sent. This is the idempotency latch:
-- non-null means DO NOT send again, and it is claimed with a conditional
-- update (`where id = $1 and follow_up_sent_at is null`) so two overlapping
-- runs cannot both send. It is deliberately KEPT SET on an ambiguous send
-- failure — a duplicate "please rate us" is a worse outcome than a missing
-- one — and released back to null only on a proven failure.
alter table orders add column if not exists follow_up_sent_at timestamptz;

-- Last failure reason from the follow-up attempt. Free text, because the
-- useful part is usually Shopee's own error string. Purely diagnostic:
-- nothing branches on it.
alter table orders add column if not exists follow_up_error text;

-- Incremented on each claim, so an order that can never be followed up
-- (buyer deleted, chat permission revoked) drops out of the job's query after
-- MAX_FOLLOW_UP_ATTEMPTS instead of costing two Shopee API calls every night
-- until it ages past the contact window.
alter table orders add column if not exists follow_up_attempts int not null default 0;

-- ── Index: orders still awaiting a follow-up ──────────────────
-- Supports the job's one query: "delivered, not yet followed up, oldest
-- first". Partial on `follow_up_sent_at is null` because the happy-path rows
-- — everything already followed up, i.e. eventually the whole table — must
-- not bloat it; it stays roughly the size of the current backlog.
--
-- For the planner to use it, the job's query MUST repeat that predicate
-- verbatim, i.e.
--   select ... from orders where follow_up_sent_at is null order by delivered_at
-- The extra filters the job adds on top (source, the delivered_at window,
-- follow_up_attempts) are fine — the planner still matches the partial
-- predicate and filters the rest. lib/follow-up.ts carries the same note.
create index if not exists orders_pending_follow_up_idx
  on orders (delivered_at)
  where follow_up_sent_at is null;
