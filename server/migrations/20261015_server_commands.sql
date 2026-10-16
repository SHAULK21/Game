-- Canonical character ownership is enabled only by successful finite-command
-- creation or verified one-time migration, never by a checkpoint endpoint.
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_migration_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE owned_items ADD COLUMN IF NOT EXISTS character_id TEXT;
CREATE TABLE IF NOT EXISTS game_operations (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  operation_id UUID NOT NULL,
  request_hash TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('applied','rejected')),
  result_json JSONB NOT NULL,
  result_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(telegram_id,reset_version,operation_id)
);
CREATE TABLE IF NOT EXISTS game_ledger_ids (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  PRIMARY KEY(telegram_id,item_id)
);
INSERT INTO game_ledger_ids(telegram_id,item_id)
SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS character_migration_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  progress_version BIGINT NOT NULL,
  source TEXT NOT NULL,
  save_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS progress_api_operations (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  reset_version INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(telegram_id,operation_id)
);

ALTER TABLE expedition_operations ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'applied' CHECK(outcome IN ('applied','rejected'));

-- Preserve historical ledger identities from the draft progress rollout too.
DO $$ BEGIN
 IF to_regclass('progress_ledger_ids') IS NOT NULL THEN
   INSERT INTO game_ledger_ids(telegram_id,item_id)
   SELECT telegram_id,item_id FROM progress_ledger_ids ON CONFLICT DO NOTHING;
 END IF;
END $$;
