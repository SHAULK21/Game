CREATE TABLE IF NOT EXISTS players (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT NOT NULL,
  clan_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clans (
  id UUID PRIMARY KEY,
  tag VARCHAR(6) NOT NULL UNIQUE,
  name VARCHAR(32) NOT NULL UNIQUE,
  description VARCHAR(280) NOT NULL DEFAULT '',
  owner_telegram_id BIGINT NOT NULL REFERENCES players(telegram_id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  treasury_gold BIGINT NOT NULL DEFAULT 0 CHECK (treasury_gold >= 0),
  max_members INTEGER NOT NULL DEFAULT 20,
  raid_name TEXT NOT NULL DEFAULT 'Колосс Пустоты',
  raid_hp BIGINT NOT NULL DEFAULT 1000000,
  raid_max_hp BIGINT NOT NULL DEFAULT 1000000,
  raid_reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_clan_fk'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_clan_fk
      FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE SET NULL;
  END IF;
END $;

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clan_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS clan_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_chat_clan_time ON clan_chat_messages(clan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_clan ON players(clan_id);
