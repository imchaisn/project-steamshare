-- ============================================================
-- 0013_supplier_code_log.sql
-- Project Steamshare — a ledger of every code fetched from our other websites
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- INDEPENDENT of every earlier migration. Adds one new table and touches
-- nothing that exists. It is, however, only useful alongside 0011 and 0012,
-- which are what make a code come from another of our sites at all.
--
-- WHY THIS EXISTS
--
-- Two things we could not see before, both learned the expensive way:
--
-- 1. REDEMPTIONS ARE FINITE. Each order id on the other site may be redeemed
--    only about 5-6 times before it returns REACHED LIMIT and needs a manual
--    reset. On 2026-09-06 an order was exhausted by development testing with
--    no warning of any kind, because nothing counted the fetches. This table
--    is that counter.
--
-- 2. WE COULD NOT TELL WHEN A CODE CHANGED. A Guard code is emailed once per
--    Steam login attempt and stays the same on every fetch until it expires;
--    a NEW one appears only after a NEW login. Knowing when the value actually
--    changed is what separates "the buyer logged in again" from "the buyer
--    pressed the button twice".
--
-- WHAT IS DELIBERATELY NOT STORED: the code itself.
--
-- Only a short fingerprint of it is kept. That is enough to answer "did it
-- change?", "how many times have we spent this order?" and "which fetch served
-- the same value as which" — without putting a live credential at rest in a
-- database whose admin panel is already the weakest link (see CHECKPOINT.md
-- open item 0b). A code also expires within roughly two hours, so its value to
-- support decays almost immediately, while the risk of storing it would not.
-- If the plaintext is ever genuinely needed, add an encrypted column then, with
-- the same AES-256-GCM path used for passwords — do not weaken this one.

create table if not exists supplier_code_log (
  id                uuid        primary key default uuid_generate_v4(),

  -- Which of OUR orders triggered this. Nullable and `on delete set null` so
  -- deleting a test order preserves the redemption history it spent — the
  -- count against the other site's order is what matters, and it survives us.
  order_id          uuid        references orders(id) on delete set null,

  -- The other site, and ITS order id. Kept as plain text rather than a foreign
  -- key: this is a record of what we asked THEM for, and it must stay true even
  -- if we later re-map or delete our own row.
  supplier_site     text        not null,
  supplier_order_id text        not null,

  -- What came back. Matches CodeFailureReason in lib/code-source/types.ts plus
  -- 'success'. NO CHECK CONSTRAINT pinning the vocabulary — 0008 and 0011 both
  -- record why: a guessed enum in SQL makes a production insert fail on a value
  -- that is merely spelled differently. TypeScript owns the vocabulary.
  outcome           text        not null,

  -- Short hash of the code. Null unless outcome = 'success'.
  code_fingerprint  text,

  -- True when this fingerprint differs from the previous SUCCESSFUL fetch for
  -- the same supplier_order_id. Null when outcome is not 'success', because
  -- "changed" is meaningless without a code. The first ever success is true.
  code_changed      boolean,

  fetched_at        timestamptz not null default now()
);

-- The two questions this table exists to answer, both against one order:
--   "how many redemptions has it spent?"      -> count over this index
--   "what was the last code, and did it change?" -> first row, fetched_at desc
create index if not exists supplier_code_log_order_idx
  on supplier_code_log (supplier_site, supplier_order_id, fetched_at desc);

-- Supports the admin view listing recent activity across every order.
create index if not exists supplier_code_log_recent_idx
  on supplier_code_log (fetched_at desc);

alter table supplier_code_log enable row level security;
