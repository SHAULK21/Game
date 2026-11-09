import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = 1.8e12; const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const [id, c] of [[1, 'warrior'], [2, 'druid'], [3, 'mage']]) { pool.ensurePlayer({id, displayName: 'P' + id}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {level: 20, class_id: c, character_name: 'P' + id}); }
const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
let r = await call(1, '/api/coop/create', 'POST', {dungeonId: 'spider_den'}); await call(2, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(3, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(1, '/api/coop/start', 'POST');
r = await call(2, '/api/coop/act', 'POST', {action: 'spell'}); console.log(r.status, r.body.error || '', JSON.stringify(r.body.room?.chain));
now += 1500; r = await call(1, '/api/coop/room'); console.log('p1 view chain', JSON.stringify(r.body.room.chain));
r = await call(1, '/api/coop/act', 'POST', {action: 'spell'}); console.log(r.status, r.body.error || '', JSON.stringify(r.body.room?.chain));
now += 1000; r = await call(3, '/api/coop/act', 'POST', {action: 'spell'});
console.log(world.tables.coop_rooms[0].log.slice(-5).map(l => l.text).join('\n'));
