-- ============================================================
-- 0006_shopee_auth.sql
-- Project Steamshare — Shopee Open Platform token storage + push audit log
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

-- ── shopee_auth ───────────────────────────────────────────────
-- One row per authorized shop (Steamshare runs a single shop today, but
-- keyed by shop_id rather than a sentinel row since Shopee's own token
-- model is per-shop_id — see 2026-09-03-shopee-auth-and-push-mechanism-spec.md
-- §1.6: refreshing generates independent tokens per shop_id/merchant_id).
-- Tokens are AES-256-GCM encrypted at rest via lib/encryption.ts, same as
-- steam_accounts.password_enc — these are live credentials to the shop.
create table shopee_auth (
  shop_id                 bigint      primary key,
  access_token_enc        text        not null,
  refresh_token_enc       text        not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  authorized_at           timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── shopee_push_log ───────────────────────────────────────────
-- Audit trail of every inbound Push Mechanism (webhook) call. Shopee does
-- NOT redeliver notifications missed while a subscription is disabled (spec
-- §2.7), so this table is the reconciliation record, not just a log —
-- if push delivery ever drops, this is what a poll-based catch-up job reads
-- against. raw_payload keeps the untouched JSON for exactly that purpose.
create table shopee_push_log (
  id               uuid        primary key default uuid_generate_v4(),
  push_code        int,                     -- Shopee's `code` field (3 = Order Status Update)
  shop_id          bigint,
  ordersn          text,                    -- Shopee's order_sn, when present in the payload
  order_status     text,                    -- payload's data.status, when present
  signature_valid  boolean     not null,
  raw_payload      jsonb       not null,
  received_at      timestamptz not null default now()
);

create index shopee_push_log_ordersn_idx on shopee_push_log (ordersn);
create index shopee_push_log_received_idx on shopee_push_log (received_at desc);
