import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const id of [1, 2]) { pool.ensurePlayer({id, displayName: 'P' + id}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {level: 20, character_name: 'P' + id}); }
world.tables.players.find(p => p.telegram_id == 2).market_gold = 0;
const soc = (u, path, body) => handleSocialRequest(world, {path, method: 'POST', body}, {id: u}, now);
const eng = (u, path, method = 'GET', body) => E.handleProgressRequest(world, {path, method, headers: {'x-game-reset-version': '0'}, body}, {id: u, displayName: 'P' + u}, {now: () => now});
const sword = {id: 'loc-1', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 3, stats: {attack: 95, critChance: 4}, icon: '⚔️', sellPrice: 40, stackCount: 1};
const op = crypto.randomUUID();
let r = await soc(1, '/api/items/deposit', {operationId: op, item: sword}); console.log('deposit', r.status, r.body.itemId?.slice(0, 8), r.body.error || '');
const id = r.body.itemId;
r = await soc(1, '/api/items/deposit', {operationId: op, item: sword}); console.log('replay', r.status, r.body.replayed, r.body.itemId === id);
console.log('fake', (await soc(1, '/api/items/deposit', {operationId: crypto.randomUUID(), item: {...sword, stats: {attack: 999999}}})).body.error);
console.log('too high lvl', (await soc(1, '/api/items/deposit', {operationId: crypto.randomUUID(), item: {...sword, level: 90}})).body.error);
console.log('material', (await soc(1, '/api/items/deposit', {operationId: crypto.randomUUID(), item: {...sword, type: 'material'}})).body.error);
r = await eng(1, '/api/items/owned'); console.log('owned has it', r.status, r.body.items?.some(i => i.id === id));
r = await eng(1, '/api/market/list', 'POST', {operationId: crypto.randomUUID(), itemId: id, item: sword, quantity: 1, price_gold: 300}); console.log('list', r.status, r.body.error || r.body.listing?.id?.slice(0, 8));
const lid = r.body.listing?.id;
r = await eng(2, '/api/market/listings'); console.log('listings visible', r.body.listings?.length);
world.tables.players.find(p => p.telegram_id == 2).gold = 1000;
r = await eng(2, '/api/market/' + lid + '/buy', 'POST', {operationId: crypto.randomUUID(), gold: 1000}); console.log('buy', r.status, r.body.error || 'ok');
try { E.validateNativeWorld(world); console.log('validate after deposit+quests: OK'); } catch (e) { console.log('VALIDATION FAILED:', e.message); }
