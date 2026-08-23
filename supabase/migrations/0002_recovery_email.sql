-- ============================================================
-- 0002_recovery_email.sql
-- Project Steamshare — recovery email fields on steam_accounts
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

alter table steam_accounts add column recovery_email text;
alter table steam_accounts add column recovery_email_password_enc text;
