import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';

export class AccountResetError extends Error {}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function resetPlayerAccount(pool: Pick<Pool, 'connect'>, adminId: number, targetId: number, operationId: string, expectedVersion: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializes retries of the same operation, including two simultaneous clicks.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [operationId]);
    const previous = (await client.query('SELECT admin_id, target_id, reset_version FROM admin_account_resets WHERE id=$1', [operationId])).rows[0];
    if (previous) {
      if (Number(previous.admin_id) !== adminId || Number(previous.target_id) !== targetId) throw new AccountResetError('ID операции уже использован.');
      await client.query('COMMIT');
      return { ok: true, resetVersion: Number(previous.reset_version) };
    }
    const target = (await client.query('SELECT telegram_id, clan_id, reset_version FROM players WHERE telegram_id=$1 FOR UPDATE', [targetId])).rows[0];
    if (!target) throw new AccountResetError('Игрок не найден.');
    if (Number(target.reset_version) !== expectedVersion) throw new AccountResetError('Данные игрока изменились. Обновите список перед сбросом.');
    if (target.clan_id) {
      const clan = (await client.query('SELECT owner_telegram_id FROM clans WHERE id=$1 FOR UPDATE', [target.clan_id])).rows[0];
      if (Number(clan?.owner_telegram_id) === targetId) {
        const next = (await client.query(`SELECT telegram_id FROM clan_members WHERE clan_id=$1 AND telegram_id<>$2
          ORDER BY CASE role WHEN 'officer' THEN 0 WHEN 'quartermaster' THEN 1 WHEN 'veteran' THEN 2 ELSE 3 END, joined_at, telegram_id LIMIT 1 FOR UPDATE`, [target.clan_id, targetId])).rows[0];
        if (next) {
          await client.query("UPDATE clan_members SET role='owner' WHERE clan_id=$1 AND telegram_id=$2", [target.clan_id, next.telegram_id]);
          await client.query('UPDATE clans SET owner_telegram_id=$1, updated_at=NOW() WHERE id=$2', [next.telegram_id, target.clan_id]);
        } else {
          await client.query('DELETE FROM clans WHERE id=$1', [target.clan_id]);
        }
      }
    }
    await client.query('DELETE FROM clan_members WHERE telegram_id=$1', [targetId]);
    await client.query('DELETE FROM owned_items WHERE owner_telegram_id=$1', [targetId]);
    await client.query("UPDATE market_listings SET status='cancelled' WHERE seller_telegram_id=$1 AND status='active'", [targetId]);
    await client.query('DELETE FROM market_listing_requests WHERE telegram_id=$1', [targetId]);
    await client.query('DELETE FROM inventory_bulk_disposals WHERE telegram_id=$1', [targetId]);
    await client.query('DELETE FROM clan_creation_requests WHERE owner_telegram_id=$1', [targetId]);
    await client.query('DELETE FROM clan_raid_item_claims WHERE telegram_id=$1', [targetId]);
    await client.query('DELETE FROM pvp_matches WHERE attacker=$1 OR defender=$1', [targetId]);
    await client.query('DELETE FROM pvp_profiles WHERE telegram_id=$1', [targetId]);
    await client.query("DELETE FROM game_notifications WHERE telegram_id=$1 AND category IN ('energy','mining','arena')", [targetId]);
    const updated = (await client.query(`UPDATE players SET character_name=NULL, level=1, arena_rating=1000,
      class_id='warrior', clan_id=NULL, reset_version=reset_version+1, reset_at=NOW(), updated_at=NOW()
      WHERE telegram_id=$1 RETURNING reset_version`, [targetId])).rows[0];
    await client.query('INSERT INTO admin_account_resets (id, admin_id, target_id, reset_version) VALUES ($1,$2,$3,$4)', [operationId, adminId, targetId, updated.reset_version]);
    await client.query('COMMIT');
    return { ok: true, resetVersion: Number(updated.reset_version) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function registerAccountReset(app: Express, getPool: () => Pool, auth: RequestHandler, admin: RequestHandler) {
  app.get('/api/profile/state', auth, async (req, res) => {
    const player = (await getPool().query('SELECT reset_version FROM players WHERE telegram_id=$1', [req.authUser!.id])).rows[0];
    res.json({ resetVersion: Number(player.reset_version) });
  });
  app.get('/api/admin/players', auth, admin, async (req, res) => {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const result = await getPool().query(`SELECT telegram_id AS "telegramId", username,
      display_name AS "displayName", character_name AS "characterName", level,
      reset_version AS "resetVersion", clan_id IS NOT NULL AS "inClan"
      FROM players WHERE $1='' OR position(lower($1) in lower(coalesce(character_name,'') || ' ' || display_name || ' ' || coalesce(username,'')))>0 OR telegram_id::text=$1
      ORDER BY updated_at DESC, telegram_id LIMIT 50`, [search.replace(/^@/, '')]);
    res.json({ players: result.rows });
  });
  app.post('/api/admin/players/:targetId/reset', auth, admin, async (req, res) => {
    const targetId = Number(req.params.targetId);
    const { operationId, expectedVersion, confirmTargetId } = req.body || {};
    if (!Number.isSafeInteger(targetId) || targetId <= 0 || String(confirmTargetId) !== String(targetId) || !uuid(operationId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      res.status(400).json({ error: 'Выберите игрока и подтвердите сброс его прогресса.' }); return;
    }
    try { res.json(await resetPlayerAccount(getPool(), req.authUser!.id, targetId, operationId, expectedVersion)); }
    catch (error) {
      if (!(error instanceof AccountResetError)) throw error;
      res.status(409).json({ error: error.message });
    }
  });
}
