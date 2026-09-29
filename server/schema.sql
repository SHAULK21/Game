CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT NOT NULL DEFAULT 'Игрок',
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
ALTER TABLE players ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS arena_rating INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE players ADD COLUMN IF NOT EXISTS clan_id UUID;
ALTER TABLE players ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS premium_charge_id TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
