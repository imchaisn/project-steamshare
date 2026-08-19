-- ============================================================
-- 0001_init.sql
-- Project Steamshare — initial schema
-- Run via: Supabase dashboard → SQL editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── steam_accounts ───────────────────────────────────────────
create table steam_accounts (
  id                uuid        primary key default uuid_generate_v4(),
  username          text        not null,
  password_enc      text        not null,        -- AES-GCM ciphertext, base64
  shared_secret_enc text        not null,         -- AES-GCM ciphertext, base64 (Steam Guard TOTP seed)
  status            text        not null default 'active',
                                                   -- active | banned | recovering
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── games ─────────────────────────────────────────────────────
create table games (
  id            uuid        primary key default uuid_generate_v4(),
  title         text        not null,
  steam_app_id  text        not null,
  created_at    timestamptz not null default now()
);

-- ── account_games ────────────────────────────────────────────
-- Which account currently holds which game. Usually 1:1, kept as
-- a join table since an account could later hold more than one game.
create table account_games (
  id          uuid        primary key default uuid_generate_v4(),
  account_id  uuid        not null references steam_accounts(id) on delete cascade,
  game_id     uuid        not null references games(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (account_id, game_id)
);

-- ── orders ────────────────────────────────────────────────────
create table orders (
  id                uuid        primary key default uuid_generate_v4(),
  shopee_order_id   text        not null,
  shopee_buyer_id   text        not null,
  account_game_id   uuid        references account_games(id) on delete set null,
  verified          boolean     not null default false,
  created_at        timestamptz not null default now(),
  unique (shopee_order_id, shopee_buyer_id)
);

-- ── code_access_log ──────────────────────────────────────────
-- Every time a code was served. Audit trail and abuse signal.
create table code_access_log (
  id          uuid        primary key default uuid_generate_v4(),
  order_id    uuid        references orders(id) on delete set null,
  ip          text,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index orders_lookup_idx        on orders (shopee_order_id, shopee_buyer_id);
create index account_games_account_idx on account_games (account_id);
create index code_access_log_order_idx on code_access_log (order_id, created_at desc);

-- ── updated_at auto-trigger ───────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger steam_accounts_set_updated_at
  before update on steam_accounts
  for each row execute function set_updated_at();

-- ── Row Level Security ────────────────────────────────────────
-- Deny-all for authenticated and anon roles. service_role bypasses
-- RLS entirely, so every write goes through createAdminClient().

alter table steam_accounts   enable row level security;
alter table games            enable row level security;
alter table account_games    enable row level security;
alter table orders           enable row level security;
alter table code_access_log  enable row level security;

create policy "deny_all" on steam_accounts   as restrictive for all to authenticated using (false);
create policy "deny_all" on games            as restrictive for all to authenticated using (false);
create policy "deny_all" on account_games    as restrictive for all to authenticated using (false);
create policy "deny_all" on orders           as restrictive for all to authenticated using (false);
create policy "deny_all" on code_access_log  as restrictive for all to authenticated using (false);

create policy "deny_all_anon" on steam_accounts   as restrictive for all to anon using (false);
create policy "deny_all_anon" on games            as restrictive for all to anon using (false);
create policy "deny_all_anon" on account_games    as restrictive for all to anon using (false);
create policy "deny_all_anon" on orders           as restrictive for all to anon using (false);
create policy "deny_all_anon" on code_access_log  as restrictive for all to anon using (false);
