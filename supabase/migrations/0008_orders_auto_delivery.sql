-- ============================================================
-- 0008_orders_auto_delivery.sql
-- Project Steamshare — orders columns for the automated Shopee delivery path
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- DEPENDS ON 0005_orders_order_id_unique.sql. Do not run this on a database
-- where 0005 has not been applied.
--
-- The entire automated pipeline is idempotent by way of ONE assumption:
-- shopee_order_id is unique on its own, so the fulfilment insert can use
-- `on conflict (shopee_order_id) do nothing` and a Shopee push retry
-- (Shopee re-pushes at 300s / 1800s / 10800s for anything it considers
-- failed — the same ordersn WILL arrive more than once) becomes a no-op.
-- Under the ORIGINAL 0001 constraint, unique(shopee_order_id, shopee_buyer_id),
-- that conflict target does not exist, so the retry inserts a SECOND row and
-- verifyShopeeOrder()'s .maybeSingle() then throws forever for that buyer —
-- the exact ssp123 failure of 2026-08-26.
--
-- Worse, this migration makes shopee_buyer_id nullable (the automated path
-- has no buyer id at all, Shopee masks buyer PII), which under the old
-- composite constraint would let UNLIMITED rows share one shopee_order_id,
-- because in Postgres NULLs are never equal to each other and so never
-- collide in a unique constraint. Applying 0008 without 0005 does not just
-- leave the bug open, it removes the last thing partially containing it.
--
-- Hence the guard below: this file refuses to run rather than leaving a
-- half-applied state that silently reintroduces duplicate orders.

do $$
begin
  -- Checked structurally, not by index name, because 0005's index
  -- (orders_shopee_order_id_key) could equally have been created by hand or
  -- promoted to a named unique constraint. What matters is that SOME valid,
  -- non-partial, single-column unique index on shopee_order_id exists.
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.orders'::regclass
      and i.indisunique
      and i.indisvalid
      and i.indnkeyatts = 1          -- exactly one key column
      and i.indpred is null          -- not a partial index
      and (
        select a.attname
        from pg_attribute a
        where a.attrelid = i.indrelid
          and a.attnum = i.indkey[0]
      ) = 'shopee_order_id'
  ) then
    -- One single-quoted literal on one line on purpose: PL/pgSQL's RAISE wants
    -- a simple string literal for its format, so the SQL lexer's
    -- adjacent-literal continuation trick is not safe to rely on here.
    raise exception 'ABORTED: orders has no single-column unique index on shopee_order_id. Apply supabase/migrations/0005_orders_order_id_unique.sql FIRST — running 0008 without it reintroduces the 2026-08-26 ssp123 duplicate-order bug, and makes it unbounded once shopee_buyer_id becomes nullable.';
  end if;
end $$;

-- ── New columns ───────────────────────────────────────────────
-- Every addition is `if not exists` so a run that died partway (e.g. the
-- connection dropped mid-migration) can simply be re-run.

-- Shopee's masked buyer handle from v2.order.get_order_detail, e.g. "j*****n".
-- Nullable: kept only so the delivery chat message and any support request can
-- be tied back to a person. Shopee has been known to omit it, and it must
-- never be a precondition for delivering a code the buyer already paid for.
alter table orders add column if not exists buyer_username text;

-- How this row got here. 'manual' = inserted by hand or by
-- scripts/seed-fleet.mjs, which is every row that exists today, hence the
-- default. The automated webhook path writes its own value.
-- NO CHECK CONSTRAINT ON PURPOSE: the value the automated path writes is not
-- settled at the time of writing this migration, and pinning a guessed enum
-- here would make the fulfilment insert fail in production on a value that is
-- merely spelled differently. Add the check in a later migration once
-- lib/fulfillment.ts has landed and the real vocabulary is known.
alter table orders add column if not exists source text not null default 'manual';

-- Set when the Shopee chat message telling the buyer their Order ID + Steam
-- username was successfully sent. This is the idempotency latch for delivery:
-- non-null means DO NOT send again. A Shopee push retry that finds
-- delivered_at already set must exit without messaging the buyer a second time.
alter table orders add column if not exists delivered_at timestamptz;

-- Last failure reason from the delivery attempt, kept as free text rather than
-- a code because the useful part is usually Shopee's own error string.
alter table orders add column if not exists delivery_error text;

-- Incremented per delivery attempt, so the reconciliation job can back off and
-- so a permanently stuck order is visible rather than retried forever.
alter table orders add column if not exists delivery_attempts int not null default 0;

-- ── shopee_buyer_id becomes nullable ──────────────────────────
-- 0001 made this not null when the lookup form still asked the buyer for
-- their buyer id. The form collects a Steam username now (see
-- app/api/lookup/route.ts), and the automated path genuinely cannot supply a
-- buyer id — Shopee's order detail masks buyer PII and returns no stable
-- buyer identifier we are entitled to store. Rather than writing a sentinel
-- string that would later be mistaken for real data, the automated path
-- leaves it null.
-- Safe to re-run: dropping a not-null that is already dropped is a no-op.
alter table orders alter column shopee_buyer_id drop not null;

-- ── Index: undelivered orders ─────────────────────────────────
-- Supports the retry / reconciliation job's one query: "orders that were
-- created but never delivered, oldest first". Partial on `delivered_at is
-- null` because the happy-path rows — the overwhelming majority once the
-- pipeline is live — are delivered and must not bloat this index; it stays
-- roughly the size of the current backlog rather than the size of the table.
--
-- For the planner to use it, the job's query MUST repeat the predicate
-- verbatim, i.e.
--   select ... from orders where delivered_at is null order by created_at
-- An extra `and delivery_attempts < n` on top is fine (the planner still
-- matches the partial predicate and filters the rest).
--
-- Deliberately NOT also filtered on `source <> 'manual'`: legacy manual rows
-- all have delivered_at null and so do sit in this index, but they number in
-- the dozens, and hard-coding a source filter here would couple the index to
-- the source vocabulary that this migration explicitly refuses to guess. If
-- manual rows ever grow enough to matter, tighten the predicate then.
create index if not exists orders_undelivered_idx
  on orders (created_at)
  where delivered_at is null;
