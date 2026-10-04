import type { Pool } from 'pg';

/** Call only after authenticating the Telegram webhook secret. */
export async function recordTelegramWriteAccess(pool: Pool, message: any): Promise<boolean> {
  if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message?.from?.id) || !message.write_access_allowed) return false;
  await pool.query(`INSERT INTO players (telegram_id, display_name, bot_started) VALUES ($1,$2,TRUE)
    ON CONFLICT (telegram_id) DO UPDATE SET bot_started=TRUE`, [message.from.id, String(message.from.first_name || 'Игрок')]);
  return true;
}
