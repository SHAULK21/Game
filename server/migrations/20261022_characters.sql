-- Positive IDs remain the original Telegram character. Extra characters use
-- an internal negative namespace; these IDs must never be sent to the Bot API.
CREATE SEQUENCE IF NOT EXISTS character_id_seq AS BIGINT INCREMENT BY -1 START WITH -1 MINVALUE -9007199254740991 MAXVALUE -1;
CREATE TABLE IF NOT EXISTS account_characters (
  character_id BIGINT PRIMARY KEY DEFAULT nextval('character_id_seq'),
  owner_id BIGINT NOT NULL CHECK(owner_id > 0),
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 4),
  UNIQUE(owner_id,slot),
  CHECK(character_id < 0)
);
