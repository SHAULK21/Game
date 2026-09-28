[object Object]
CREATE UNIQUE INDEX IF NOT EXISTS idx_clans_name_lower ON clans (LOWER(name));


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
