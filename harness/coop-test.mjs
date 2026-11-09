import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
const U = [{id: 1, displayName: 'Танк'}, {id: 2, displayName: 'Друид'}, {id: 3, displayName: 'Маг'}];
for (const u of U) pool.ensurePlayer(u);
world.tables.players.forEach((p, i) => { p.level = 14; p.class_id = ['warrior', 'druid', 'mage'][i]; p.character_name = U[i].displayName; p.bot_started = true; });
const call = async (u, path, method = 'GET', body) => { const r = await handleSocialRequest(world, {path, method, body}, u, now); E.validateNativeWorld(world); return r; };
let r = await call(U[0], '/api/coop/rooms'); console.log('dungeons', r.body.dungeons.map(d => d.id + ':' + d.minLevel).join(' '));
r = await call(U[0], '/api/coop/create', 'POST', {dungeonId: 'spider_den'}); const id = r.body.room.id; console.log('create', r.status);
console.log('start solo', (await call(U[0], '/api/coop/start', 'POST')).body);
console.log('join2', (await call(U[1], '/api/coop/join', 'POST', {roomId: id})).status, 'join3', (await call(U[2], '/api/coop/join', 'POST', {roomId: id})).status);
console.log('start', (await call(U[0], '/api/coop/start', 'POST')).body.room.foe);
let steps = 0, room;
while (steps < 2000) {
  for (const [i, u] of U.entries()) {
    const action = i === 1 ? 'heal' : (i === 0 && steps % 6 === 0 ? 'guard' : (steps % 5 === 0 ? 'power' : 'attack'));
    r = await call(u, '/api/coop/act', 'POST', {action}); room = r.body.room || room;
  }
  now += 2000; steps++;
  if (!room || room.status !== 'active') break;
}
console.log('result', room.status, 'stage', room.stage, 'steps', steps, 'time ~', steps * 2, 's');
console.log(room.log.slice(-6).map(l => l.text).join('\n'));
for (const u of U) { r = await call(u, '/api/coop/claim', 'POST'); console.log('claim', u.displayName, JSON.stringify(r.body)); }
console.log('claim again', JSON.stringify((await call(U[0], '/api/coop/claim', 'POST')).body));
