import crypto from 'node:crypto';
import { clanCreationCost } from '../src/utils/clanEconomy';

// The existing character wallet lives in the client save. The server validates
// its snapshot, calculates Premium itself and stores a replayable creation receipt.
export async function createPaidClan(pool: any, userId: number, body: any) {
  const name = String(body?.name || '').trim();
  const tag = String(body?.tag || '').trim().toUpperCase();
  const description = String(body?.description || '').trim();
  const { operationId, gold, expectedPriceGold } = body || {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId || '')) throw new Error('Неверный идентификатор создания клана.');
  if (!/^[A-ZА-ЯЁ0-9]{2,6}$/.test(tag)) throw new Error('Тег: 2–6 букв или цифр.');
  if (name.length < 3 || name.length > 32) throw new Error('Название: 3–32 символа.');
  if (description.length > 280) throw new Error('Описание слишком длинное.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['clan-create:' + operationId]);
    const receipt = (await client.query('SELECT * FROM clan_creation_requests WHERE operation_id=$1', [operationId])).rows[0];
    if (receipt) {
      if (Number(receipt.owner_telegram_id) !== userId || receipt.name !== name || receipt.tag !== tag || receipt.description !== description) throw new Error('Запрос создания клана изменился.');
      await client.query('COMMIT');
      return { ok: true, clanId: receipt.clan_id, priceGold: Number(receipt.price_gold) };
    }
    const owner = (await client.query('SELECT clan_id,(premium_until>NOW()) AS premium FROM players WHERE telegram_id=$1 FOR UPDATE', [userId])).rows[0];
    if (!owner) throw new Error('Персонаж не найден.');
    if (owner.clan_id) throw new Error('Сначала выйдите из текущего клана.');
    const cost = clanCreationCost(owner.premium === true);
    if (expectedPriceGold !== cost) throw new Error('Стоимость изменилась. Обновите статус Premium и попробуйте снова.');
    if (!Number.isSafeInteger(gold) || gold < cost) throw new Error(`Для создания клана нужно ${cost} золота.`);
    const id = crypto.randomUUID();
    await client.query('INSERT INTO clans (id,tag,name,description,owner_telegram_id) VALUES ($1,$2,$3,$4,$5)', [id,tag,name,description,userId]);
    await client.query("INSERT INTO clan_members (clan_id,telegram_id,role) VALUES ($1,$2,'owner')", [id,userId]);
    await client.query('UPDATE players SET clan_id=$1,updated_at=NOW() WHERE telegram_id=$2', [id,userId]);
    await client.query('INSERT INTO clan_creation_requests (operation_id,owner_telegram_id,clan_id,name,tag,description,price_gold) VALUES ($1,$2,$3,$4,$5,$6,$7)', [operationId,userId,id,name,tag,description,cost]);
    await client.query('COMMIT');
    return { ok: true, clanId: id, priceGold: cost };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && error.message.includes('duplicate')) throw new Error('Такое название или тег уже занят.');
    throw error;
  } finally { client.release(); }
}
