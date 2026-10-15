-- Additive foundation only. This does NOT promote a local/PR88 checkpoint
-- character to an authoritative economy. No client API may set authority.
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_json JSONB;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_session_hash TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS progress_session_generation BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS character_authority TEXT NOT NULL DEFAULT 'legacy-local';

CREATE TABLE IF NOT EXISTS expedition_accounts (
  telegram_id BIGINT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS expedition_operations (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  operation_id UUID NOT NULL,
  request_hash TEXT NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, reset_version, operation_id)
);
CREATE TABLE IF NOT EXISTS expedition_migration_backups (
  telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  reset_version INTEGER NOT NULL,
  save_json JSONB NOT NULL,
  cutover_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (telegram_id, reset_version)
);
-- 999 remains a market lot limit. Stored resource totals are not market lots.
-- Keep all existing quantities intact.
DO $$
DECLARE constraint_row RECORD;
BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid='owned_items'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%quantity%999%'
  LOOP
    EXECUTE format('ALTER TABLE owned_items DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='owned_items'::regclass AND conname='owned_items_positive_quantity') THEN
    ALTER TABLE owned_items ADD CONSTRAINT owned_items_positive_quantity CHECK (quantity > 0);
  END IF;
END $$;
