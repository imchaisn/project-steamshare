-- ============================================================
-- 0005_orders_order_id_unique.sql
-- Project Steamshare — make shopee_order_id unique on its own
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

-- Open item 6 (CHECKPOINT.md). verifyShopeeOrder() queries shopee_order_id
-- ALONE with .maybeSingle(), which throws on more than one match. The
-- table's actual constraint is unique(shopee_order_id, shopee_buyer_id), so
-- two rows sharing an order id (different buyer id) pass that constraint but
-- break every lookup on that order id — hit for real 2026-08-26 (ssp123).
-- shopee_buyer_id is legacy (the lookup form collects username now, not
-- buyer id), so the fix is a unique index on shopee_order_id alone.

-- Safety check: this fails loudly instead of silently if duplicates still
-- exist, rather than leaving them to surface as a runtime 500 later.
do $$
declare
  dupe_count int;
begin
  select count(*) into dupe_count
  from (
    select shopee_order_id
    from orders
    group by shopee_order_id
    having count(*) > 1
  ) d;

  if dupe_count > 0 then
    raise exception
      'orders has % shopee_order_id value(s) with more than one row — resolve duplicates (rename/merge, see the 2026-08-26 ssp123 fix) before running this migration',
      dupe_count;
  end if;
end $$;

alter table orders drop constraint if exists orders_shopee_order_id_shopee_buyer_id_key;
create unique index if not exists orders_shopee_order_id_key on orders (shopee_order_id);
