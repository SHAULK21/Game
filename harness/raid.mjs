import crypto from 'node:crypto';
const E = await import(process.env.ENGINE || './engine-patched.js');
const uuid = () => crypto.randomUUID(); const now = Date.now();
const world = {tables: {}}, pool = new E.NativePool(world, () => now);
const A = {id: 9301, displayName: 'A'}; pool.ensurePlayer(A);
const call = (u, path, method = 'POST', body) => E.handleProgressRequest(world, {path, method, headers: {'x-game-reset-version': '0'}, ...(body ? {body} : {})}, u, {now: () => now});
let r = await call(A, '/api/clan/create', 'POST', {name: 'Alpha Clan', tag: 'ALP', description: '', operationId: uuid(), gold: 200000, expectedPriceGold: 100000});
E.validateNativeWorld(world); console.log('after create ok');
r = await call(A, '/api/clan/raid/attack', 'POST', {damage: 100, operationId: uuid(), power: 500});
console.log(r.status, JSON.stringify(r.body).slice(0, 400));
try { E.validateNativeWorld(world); console.log('valid'); } catch (e) { console.log('INVALID', e.code); }
const players = new Set(world.tables.players.map(p => String(p.telegram_id))), clans = new Set(world.tables.clans.map(c => c.id));
for (const i of world.tables.owned_items) if (i.owner_telegram_id != null && !players.has(String(i.owner_telegram_id)) || i.clan_id != null && !clans.has(i.clan_id) || i.bound_clan_id != null && !clans.has(i.bound_clan_id)) console.log('bad item', JSON.stringify({...i, item_json: undefined}));
console.log('clans', JSON.stringify(world.tables.clans.map(c => c.id)));
