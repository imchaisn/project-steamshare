-- ============================================================
-- 0015_supplier_code_log_diagnostics.sql
-- Project Steamshare — record which account a code fetch asked about, and what
-- the other site actually said
-- Run via: Supabase dashboard → SQL editor
-- ============================================================
--
-- Depends on 0013. Adds two nullable columns and touches nothing else. Safe to
-- apply before or after the code that writes them: lib/code-source/ledger.ts
-- falls back to the old row when they are missing.
--
-- WHY THIS EXISTS
--
-- On 2026-10-30 buyers reported Resident Evil Requiem codes not working, and
-- the ledger could not explain it. Order 2609069D9MXVAP is a pool of five
-- accounts and the ledger recorded neither which one each fetch targeted nor
-- why 15 fetches came back as supplier_error. That outcome covers a wrong
-- username, a spent redemption cap, and our own timeout, which call for three
-- different responses.
--
-- WHAT IS DELIBERATELY NOT STORED: still the code, and still any password.
-- supplier_message holds only the site's short error text; the adapters never
-- copy a raw response body into it. See describeGamersfantasyFailure and
-- describeCyberspaceFailure.

alter table supplier_code_log
  add column if not exists username text,
  add column if not exists supplier_message text;
