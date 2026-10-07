CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT NOT NULL DEFAULT 'Игрок',
  character_name TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  arena_rating INTEGER NOT NULL DEFAULT 1000,
  clan_id UUID,
  premium_until TIMESTAMPTZ,
  premium_charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag VARCHAR(6) NOT NULL UNIQUE,
  name VARCHAR(32) NOT NULL,
  description VARCHAR(280) NOT NULL DEFAULT '',
  owner_telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 30,
  raid_hp INTEGER NOT NULL DEFAULT 10000,
  raid_max_hp INTEGER NOT NULL DEFAULT 10000,
  raid_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE players ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Игрок';
ALTER TABLE players ADD COLUMN IF NOT EXISTS character_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS arena_rating INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE players ADD COLUMN IF NOT EXISTS clan_id UUID;
ALTER TABLE players ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS premium_charge_id TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE players ADD COLUMN IF NOT EXISTS reset_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_account_resets (
  id UUID PRIMARY KEY,
  admin_id BIGINT NOT NULL REFERENCES players(telegram_id),
  target_id BIGINT NOT NULL REFERENCES players(telegram_id),
  reset_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clans ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 30;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS raid_hp INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS raid_max_hp INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS raid_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days';
ALTER TABLE clans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE clans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE clans ADD COLUMN IF NOT EXISTS treasury_gold BIGINT NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS treasury_silver BIGINT NOT NULL DEFAULT 0;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS treasury_ore BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_clan_id_fkey'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_clan_id_fkey
      FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clans_name_lower ON clans (LOWER(name));

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clan_id, telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_clan_members_user ON clan_members(telegram_id);

CREATE TABLE IF NOT EXISTS clan_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clan_chat_created ON clan_chat_messages(clan_id, created_at DESC);

-- Transferable items are minted and moved only by the server. Local legacy saves
-- are deliberately excluded from this ledger until their origin can be verified.
CREATE TABLE IF NOT EXISTS owned_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_telegram_id BIGINT REFERENCES players(telegram_id) ON DELETE CASCADE,
  clan_id UUID REFERENCES clans(id) ON DELETE CASCADE,
  bound_clan_id UUID REFERENCES clans(id) ON DELETE SET NULL,
  item_json JSONB NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  equipped_slot VARCHAR(20),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  origin VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owned_items_one_holder CHECK ((owner_telegram_id IS NULL) <> (clan_id IS NULL))
);
ALTER TABLE owned_items ADD COLUMN IF NOT EXISTS equipped_slot VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_owned_items_equipped_slot ON owned_items(owner_telegram_id, equipped_slot) WHERE equipped_slot IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owned_items_player ON owned_items(owner_telegram_id) WHERE owner_telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owned_items_clan ON owned_items(clan_id) WHERE clan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS clan_storage_events (
  id BIGSERIAL PRIMARY KEY,
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  actor_telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  action VARCHAR(24) NOT NULL,
  item_name VARCHAR(80) NOT NULL,
  quantity INTEGER NOT NULL,
  gold_delta BIGINT NOT NULL DEFAULT 0,
  silver_delta BIGINT NOT NULL DEFAULT 0,
  ore_delta BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clan_storage_events ON clan_storage_events(clan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clan_raid_item_claims (
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  PRIMARY KEY (telegram_id, period_start)
);

CREATE TABLE IF NOT EXISTS global_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_chat_created ON global_chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  item_json JSONB NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 999),
  price_gold INTEGER NOT NULL CHECK (price_gold > 0),
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
CREATE INDEX IF NOT EXISTS idx_market_active ON market_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_telegram_id, status);

ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS sale_tax_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS seller_net_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS premium_payments (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  telegram_payment_charge_id TEXT NOT NULL UNIQUE,
  amount_stars INTEGER NOT NULL CHECK (amount_stars > 0),
  subscription_expiration_date TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  is_first_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_premium_payments_user
  ON premium_payments(telegram_id, created_at DESC);

-- Idempotent receipts let the client recover rewards after an interrupted bulk action.
CREATE TABLE IF NOT EXISTS inventory_bulk_disposals (
  id UUID PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  request_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_bulk_disposals_user ON inventory_bulk_disposals(telegram_id, created_at DESC);

-- Notifications survive process restarts and are delivered by the bot worker.
ALTER TABLE players ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS bot_started BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS class_id TEXT NOT NULL DEFAULT 'warrior';
ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES players(telegram_id);
CREATE TABLE IF NOT EXISTS game_notifications (
 id BIGSERIAL PRIMARY KEY, telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
 event_key TEXT NOT NULL, category TEXT NOT NULL, text TEXT NOT NULL,
 due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (telegram_id,event_key)
);
CREATE INDEX IF NOT EXISTS idx_game_notifications_pending ON game_notifications(due_at,next_attempt_at) WHERE sent_at IS NULL;
CREATE TABLE IF NOT EXISTS referral_rewards (
 invitee BIGINT PRIMARY KEY REFERENCES players(telegram_id), inviter BIGINT NOT NULL REFERENCES players(telegram_id), rewarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_premium_grants (
 id UUID PRIMARY KEY, telegram_id BIGINT NOT NULL REFERENCES players(telegram_id), days INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE clan_members DROP CONSTRAINT IF EXISTS clan_members_role_check;
ALTER TABLE clan_members ADD CONSTRAINT clan_members_role_check CHECK (role IN ('owner','officer','quartermaster','veteran','member','recruit'));
ALTER TABLE clan_members ADD COLUMN IF NOT EXISTS raid_damage BIGINT NOT NULL DEFAULT 0;
ALTER TABLE clan_members ADD COLUMN IF NOT EXISTS last_raid_attack TIMESTAMPTZ;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS recruitment_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE clans ADD COLUMN IF NOT EXISTS min_join_level INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS clan_management_events (
 id BIGSERIAL PRIMARY KEY, clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
 actor BIGINT NOT NULL, text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Equalized asynchronous PvP: no client-provided damage, wallet or match result.
CREATE TABLE IF NOT EXISTS pvp_profiles (
 telegram_id BIGINT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
 rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
 tickets INTEGER NOT NULL DEFAULT 5, ticket_day DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
 stance TEXT NOT NULL DEFAULT 'balanced' CHECK (stance IN ('balanced','assault','guard','control')),
 enrolled BOOLEAN NOT NULL DEFAULT FALSE, last_fight_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS pvp_matches (
 id UUID PRIMARY KEY, attacker BIGINT NOT NULL REFERENCES players(telegram_id), defender BIGINT NOT NULL REFERENCES players(telegram_id),
 result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_pair ON pvp_matches(attacker,defender,created_at DESC);
CREATE TABLE IF NOT EXISTS market_listing_requests (
 id UUID PRIMARY KEY, telegram_id BIGINT NOT NULL REFERENCES players(telegram_id), request_json JSONB NOT NULL,
 listing_id UUID NOT NULL REFERENCES market_listings(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_broadcasts (
 id UUID PRIMARY KEY, admin_id BIGINT NOT NULL REFERENCES players(telegram_id),
 template_id TEXT NOT NULL, audience TEXT NOT NULL, text TEXT NOT NULL,
 players_count INTEGER NOT NULL DEFAULT 0, telegram_count INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clan_creation_requests (
  operation_id UUID PRIMARY KEY,
  owner_telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  clan_id UUID NOT NULL,
  name TEXT NOT NULL,
  tag TEXT NOT NULL,
  description TEXT NOT NULL,
  price_gold INTEGER NOT NULL CHECK (price_gold > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clans ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS clan_project_operations (
  id UUID PRIMARY KEY, clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  actor BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  project TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Diagnostics only: these records do not authorize rewards or player progression.
CREATE TABLE IF NOT EXISTS balance_sessions (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  id UUID NOT NULL, sequence INTEGER NOT NULL, level INTEGER NOT NULL,
  duration_ms BIGINT NOT NULL, net_gold BIGINT NOT NULL, net_silver BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(telegram_id,id)
);
CREATE TABLE IF NOT EXISTS balance_battles (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  id UUID NOT NULL, session_id UUID NOT NULL, level INTEGER NOT NULL, class_id TEXT NOT NULL,
  region TEXT NOT NULL, monster TEXT NOT NULL, difficulty TEXT NOT NULL, outcome TEXT NOT NULL,
  rounds INTEGER NOT NULL, duration_ms BIGINT NOT NULL, gold BIGINT NOT NULL, silver BIGINT NOT NULL, exp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(telegram_id,id)
);
ALTER TABLE balance_battles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX IF NOT EXISTS balance_battles_date ON balance_battles(created_at);
CREATE INDEX IF NOT EXISTS balance_sessions_date ON balance_sessions(created_at);
ALTER TABLE balance_sessions ADD COLUMN IF NOT EXISTS start_level INTEGER;
ALTER TABLE balance_sessions ADD COLUMN IF NOT EXISTS max_level INTEGER;
ALTER TABLE balance_sessions ADD COLUMN IF NOT EXISTS last_screen TEXT;
ALTER TABLE balance_sessions ADD COLUMN IF NOT EXISTS last_state TEXT;
ALTER TABLE balance_sessions ADD COLUMN IF NOT EXISTS energy INTEGER;
CREATE INDEX IF NOT EXISTS balance_sessions_player_date ON balance_sessions(telegram_id,created_at);
CREATE TABLE IF NOT EXISTS balance_progress (
 telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
 session_id UUID NOT NULL, level INTEGER NOT NULL, active_ms BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(telegram_id,session_id,level)
);

CREATE TABLE IF NOT EXISTS balance_activity (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
  PRIMARY KEY(telegram_id,day)
);

-- UI language is independent of notifications opt-in and character resets.
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_language TEXT CHECK (preferred_language IN ('ru', 'uk'));

ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_interface TEXT CHECK (preferred_interface IN ('modern', 'fantasy', 'fantasy-beta'));

-- Public trading accepts only server-issued items and uses its own authoritative wallet.
ALTER TABLE players ADD COLUMN IF NOT EXISTS market_gold BIGINT NOT NULL DEFAULT 120 CHECK (market_gold >= 0);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS seller_reset_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS buyer_telegram_id BIGINT REFERENCES players(telegram_id);
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS purchased_item_id UUID;
ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS returned_item_id UUID;
CREATE TABLE IF NOT EXISTS market_purchase_requests (
  id UUID PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES market_listings(id),
  reset_version INTEGER NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
