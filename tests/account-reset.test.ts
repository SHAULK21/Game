import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { resetPlayerAccount, registerAccountReset } from '../server/accountReset';
import { applyAccountReset, GAME_SAVE_KEY, gameSaveKey, resetVersionKey } from '../src/utils/accountReset';

test('selected account resets transactionally, preserving Premium and other players; retries do not reset twice', async () => {
  const db = new PGlite();
  const query = (sql: string, args: any[] = []) => db.query<Record<string, any>>(sql, args);
  const pool: any = { query, connect: async () => ({ query, release() {} }) };
  try {
    await db.exec((await fs.readFile('server/schema.sql', 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    await query("INSERT INTO players (telegram_id,character_name,level,premium_until) VALUES (1,'Админ',30,NOW()+INTERVAL '30 days'),(2,'Цель',40,NOW()+INTERVAL '7 days'),(3,'Другой',20,NULL)");
    const before = (await query('SELECT premium_until FROM players WHERE telegram_id=2')).rows[0].premium_until;
    const clan = (await query("INSERT INTO clans (tag,name,owner_telegram_id) VALUES ('TST','Тест',2) RETURNING id")).rows[0].id;
    await query("INSERT INTO clan_members (clan_id,telegram_id,role) VALUES ($1,2,'owner'),($1,3,'officer')", [clan]);
    await query('UPDATE players SET clan_id=$1 WHERE telegram_id IN (2,3)', [clan]);
    await query("INSERT INTO owned_items (owner_telegram_id,item_json,origin) VALUES (2,'{}','test'),(3,'{}','test')");
    await query("INSERT INTO market_listings (seller_telegram_id,item_json,price_gold) VALUES (2,'{}',100),(3,'{}',200)");
    await query('INSERT INTO pvp_profiles (telegram_id,rating,wins) VALUES (2,1500,5),(3,1100,2)');
    const id = 'a1234567-1234-4123-8123-123456789012';
    assert.deepEqual(await resetPlayerAccount(pool, 1, 2, id, 0), { ok: true, resetVersion: 1 });
    assert.deepEqual(await resetPlayerAccount(pool, 1, 2, id, 0), { ok: true, resetVersion: 1 });
    const target = (await query('SELECT * FROM players WHERE telegram_id=2')).rows[0];
    assert.equal(target.level, 1); assert.equal(target.character_name, null); assert.equal(target.clan_id, null);
    assert.deepEqual(target.premium_until, before);
    assert.equal((await query('SELECT level FROM players WHERE telegram_id=3')).rows[0].level, 20);
    assert.equal(Number((await query('SELECT owner_telegram_id FROM clans WHERE id=$1', [clan])).rows[0].owner_telegram_id), 3);
    assert.equal((await query('SELECT count(*)::int AS n FROM owned_items WHERE owner_telegram_id=2')).rows[0].n, 0);
    assert.equal((await query('SELECT count(*)::int AS n FROM owned_items WHERE owner_telegram_id=3')).rows[0].n, 1);
    assert.equal((await query('SELECT status FROM market_listings WHERE seller_telegram_id=2')).rows[0].status, 'cancelled');
    assert.equal((await query('SELECT status FROM market_listings WHERE seller_telegram_id=3')).rows[0].status, 'active');
    assert.equal((await query('SELECT count(*)::int AS n FROM pvp_profiles WHERE telegram_id=2')).rows[0].n, 0);
    await assert.rejects(() => resetPlayerAccount(pool, 1, 2, 'b1234567-1234-4123-8123-123456789012', 0), /Данные игрока изменились/);
    await assert.rejects(() => resetPlayerAccount(pool, 1, 3, id, 0), /ID операции/);
    assert.equal((await query('SELECT count(*)::int AS n FROM admin_account_resets')).rows[0].n, 1);
    const update = await query('UPDATE players SET level=99 WHERE telegram_id=2 AND reset_version=0');
    assert.equal(update.affectedRows, 0);
    assert.equal((await query('SELECT level FROM players WHERE telegram_id=2')).rows[0].level, 1);
    // An owner alone loses only their own clan, not other players or Premium.
    await query('DELETE FROM clan_members WHERE telegram_id=2');
    const solo = (await query("INSERT INTO clans (tag,name,owner_telegram_id) VALUES ('SOL','Один',2) RETURNING id")).rows[0].id;
    await query("INSERT INTO clan_members (clan_id,telegram_id,role) VALUES ($1,2,'owner')", [solo]);
    await query('UPDATE players SET clan_id=$1 WHERE telegram_id=2', [solo]);
    await resetPlayerAccount(pool, 1, 2, 'c1234567-1234-4123-8123-123456789012', 1);
    assert.equal((await query('SELECT count(*)::int AS n FROM clans WHERE id=$1', [solo])).rows[0].n, 0);
  } finally { await db.close(); }
});

test('reset API checks admin rights and exact target confirmation; search uses parameterized queries', async () => {
  const app = express(); app.use(express.json());
  let calls = 0;
  const pool: any = { query: async (_sql: string, args: any[]) => { calls++; return { rows: [{ telegramId: '2', search: args[0], reset_version: 0 }] }; } };
  registerAccountReset(app, () => pool, (req, _res, next) => { req.authUser = { id: 1, displayName: 'Admin' }; next(); }, (req, res, next) => { if (req.get('test-admin') !== 'yes') { res.status(403).json({ error: 'Только администратор.' }); return; } next(); });
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as any).port;
  try {
    assert.equal((await fetch(url + '/api/admin/players')).status, 403);
    assert.equal((await fetch(url + '/api/admin/players/2/reset', { method: 'POST' })).status, 403);
    assert.equal(calls, 0);
    const invalid = await fetch(url + '/api/admin/players/2/reset', { method: 'POST', headers: { 'test-admin': 'yes', 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: 'a1234567-1234-4123-8123-123456789012', expectedVersion: 0, confirmTargetId: '3' }) });
    assert.equal(invalid.status, 400); assert.equal(calls, 0);
    const search = "name' OR 1=1 --";
    const result = await (await fetch(url + '/api/admin/players?search=' + encodeURIComponent(search), { headers: { 'test-admin': 'yes' } })).json();
    assert.equal(result.players[0].search, search);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('server reset clears legacy local saves and pending rewards, retaining interface and identity', () => {
  const entries = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) } });
  try {
    entries.set(GAME_SAVE_KEY, JSON.stringify({ player: { userId: '2', level: 40 } }));
    entries.set('aethelgard_market_pending_2', 'pending'); entries.set('aethelgard_market_income_2', '100');
    entries.set('aethelgard_interface_style', 'fantasy'); entries.set('aethelgard_mock_user', 'identity');
    assert.equal(applyAccountReset(2, 1), true);
    assert.equal(entries.has(GAME_SAVE_KEY), false); assert.equal(entries.has('aethelgard_market_pending_2'), false);
    assert.equal(entries.get('aethelgard_interface_style'), 'fantasy'); assert.equal(entries.get('aethelgard_mock_user'), 'identity');
    assert.equal(entries.get(resetVersionKey(2)), '1'); assert.equal(applyAccountReset(2, 1), false);
    entries.set(GAME_SAVE_KEY, JSON.stringify({ player: { userId: '2', level: 3 } }));
    entries.set('aethelgard_market_pending_2', 'new-operation');
    for (let visit = 0; visit < 3; visit++) {
      assert.equal(applyAccountReset(2, 1), false, 'same admin reset must not erase newly created progress, even in a legacy save');
      assert.equal(JSON.parse(entries.get(GAME_SAVE_KEY)!).player.level, 3);
      assert.equal(entries.get('aethelgard_market_pending_2'), 'new-operation');
    }
    entries.set(GAME_SAVE_KEY, JSON.stringify({ resetVersion: 1, player: { userId: 2, level: 3 } }));
    entries.delete(resetVersionKey(2));
    assert.equal(applyAccountReset(2, 1), false, 'an annotated new save recovers a missing acknowledgement');
    assert.equal(entries.get(resetVersionKey(2)), '1');
    assert.equal(applyAccountReset(2, 0), false); assert.equal(entries.get(resetVersionKey(2)), '1');
    assert.equal(entries.has(gameSaveKey(2)), true);
    assert.equal(applyAccountReset(2, 2), true);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete (globalThis as any).localStorage; }
});
