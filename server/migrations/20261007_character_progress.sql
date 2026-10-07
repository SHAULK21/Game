-- Idempotent; existing player, wallet and owned_items rows are preserved.
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_json JSONB;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_session_hash TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_session_generation BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_migration_open BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS progress_operations (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  reset_version INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  result_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, operation_id)
);
CREATE TABLE IF NOT EXISTS progress_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  progress_version BIGINT NOT NULL,
  source TEXT NOT NULL,
  save_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS progress_ledger_ids (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  PRIMARY KEY (telegram_id,item_id)
);
INSERT INTO progress_ledger_ids (telegram_id,item_id)
SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS progress_api_operations (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  reset_version INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id,operation_id)
);
