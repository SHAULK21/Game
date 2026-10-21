import type {Pool} from 'pg';
import {ProgressError} from './progressValidation';

export const CHARACTER_LIMIT = 5;
export function characterSlot(value: unknown): number {
  if (value === undefined || value === '') return 0;
  if (!/^[0-4]$/.test(String(value))) throw new ProgressError('INVALID_CHARACTER', 'Некорректный слот персонажа.', 400);
  return Number(value);
}
// Payments, referral rewards and Telegram preferences belong to the real account.
export const accountRoute = (path: string) => path !== '/api/notifications/schedule' && /^\/api\/(?:characters|premium|referrals|preferences|notifications|admin)(?:\/|$)/.test(path);
export function characterSummary(slot: number, row: any) {
  return {slot, id: String(row.telegram_id), name: row.character_name || row.progress_json?.player?.name || '',
    level: Number(row.level || 1), classId: row.class_id || row.progress_json?.player?.classId || null};
}
export async function resolveCharacter(pool: Pick<Pool, 'query'>, owner: number, slot: number): Promise<number> {
  if (!slot) return owner;
  const row = (await pool.query('SELECT character_id FROM account_characters WHERE owner_id=$1 AND slot=$2', [owner, slot])).rows[0];
  if (!row) throw new ProgressError('CHARACTER_NOT_FOUND', 'Персонаж не найден. Выберите другого персонажа.', 404);
  return Number(row.character_id);
}
export async function listCharacters(pool: Pick<Pool, 'query'>, owner: number) {
  const rows = (await pool.query(`SELECT p.*, COALESCE(c.slot,0) AS character_slot FROM players p
    LEFT JOIN account_characters c ON c.character_id=p.telegram_id
    WHERE p.telegram_id=$1 OR c.owner_id=$1 ORDER BY character_slot`, [owner])).rows;
  return {characters: rows.map(row => characterSummary(Number(row.character_slot), row)), limit: CHARACTER_LIMIT};
}
export async function addCharacter(pool: Pool, owner: number, slot: number, identity: {displayName: string; username?: string}) {
  if (!slot) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize slot allocation for retries and concurrent devices.
    await client.query('SELECT telegram_id FROM players WHERE telegram_id=$1 FOR UPDATE', [owner]);
    const row = (await client.query(`INSERT INTO account_characters(owner_id,slot) VALUES($1,$2)
      ON CONFLICT(owner_id,slot) DO UPDATE SET slot=EXCLUDED.slot RETURNING character_id`, [owner, slot])).rows[0];
    await client.query('INSERT INTO players(telegram_id,username,display_name) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO NOTHING', [row.character_id, identity.username || null, identity.displayName]);
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK'); throw error;}
  finally {client.release();}
}
