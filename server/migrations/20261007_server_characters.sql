-- Existing characters are local: never invent a server hero from players.level.
CREATE TABLE IF NOT EXISTS character_saves (
 telegram_id BIGINT PRIMARY KEY REFERENCES players(telegram_id) ON DELETE CASCADE,
 reset_version INTEGER NOT NULL,
 version BIGINT NOT NULL DEFAULT 0 CHECK(version>=0),
 state_json JSONB,
 active_session UUID,
 session_generation BIGINT NOT NULL DEFAULT 0,
 migration_until TIMESTAMPTZ,
 migration_imported BOOLEAN NOT NULL DEFAULT FALSE,
 migration_conflict_resolved BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS character_operations (
 telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
 reset_version INTEGER NOT NULL,
 operation_id UUID NOT NULL,
 session_generation BIGINT NOT NULL,
 request_json JSONB NOT NULL,
 response_json JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(telegram_id,reset_version,operation_id)
);
CREATE TABLE IF NOT EXISTS character_backups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
 reset_version INTEGER NOT NULL,
 source VARCHAR(24) NOT NULL,
 snapshot_json JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- This timestamp is written once. Restarts never extend/reopen the import window.
CREATE TABLE IF NOT EXISTS game_schema_migrations (
 name TEXT PRIMARY KEY,
 applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO game_schema_migrations(name) VALUES('server_characters_v1') ON CONFLICT DO NOTHING;
INSERT INTO character_saves(telegram_id,reset_version,migration_until)
 SELECT p.telegram_id,p.reset_version,m.applied_at+INTERVAL '30 days'
 FROM players p CROSS JOIN game_schema_migrations m
 WHERE m.name='server_characters_v1'
 ON CONFLICT(telegram_id) DO NOTHING;

ALTER TABLE character_saves ADD COLUMN IF NOT EXISTS migration_imported BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE character_saves ADD COLUMN IF NOT EXISTS migration_conflict_resolved BOOLEAN NOT NULL DEFAULT FALSE;
