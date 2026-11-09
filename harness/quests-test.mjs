import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const [id, c] of [[1, 'warrior'], [2, 'druid']]) { pool.ensurePlayer({id, displayName: 'P' + id}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {level: 30, class_id: c, character_name: 'P' + id}); }
const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
let r = await call(1, '/api/coop/create', 'POST', {dungeonId: 'goblin_cave'}); await call(2, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(1, '/api/coop/start', 'POST');
for (let i = 0; i < 3000; i++) { now += 300; const room = (await call(1, '/api/coop/room')).body.room; if (!room || room.status !== 'active') break;
  if (room.phase === 'choose') { await call(1, '/api/coop/choose', 'POST', {optionId: room.options[0].id}); continue; }
  for (const u of [2, 1]) { const m = room.members.find(x => x.id == u); const a = !m.cooldowns?.spell ? 'spell' : m.hp < m.maxHp * 0.4 && !m.cooldowns?.heal ? 'heal' : !m.cooldowns?.power ? 'power' : 'attack'; await call(u, '/api/coop/act', 'POST', {action: a}); } }
console.log('coop status', world.tables.coop_rooms[0].status);
for (let k = 0; k < 3; k++) { let d = (await call(1, '/api/duel/start', 'POST', {targetId: 2})).body.duel; for (let t = 0; t < 60 && d.status === 'active'; t++) d = (await call(1, '/api/duel/act', 'POST', {action: d.me.cd === 0 ? 'skill' : 'attack'})).body.duel; }
const q = (await call(1, '/api/quests/special')).body.quests; console.log(q.map(x => `${x.id} ${x.progress}/${x.need}`).join(' | '));
r = await call(1, '/api/quests/special/claim', 'POST', {id: 'd_coop_win'}); console.log('claim', r.status, JSON.stringify(r.body));
r = await call(1, '/api/quests/special/claim', 'POST', {id: 'd_coop_win'}); console.log('again', r.body.error);
r = await call(1, '/api/quests/special/claim', 'POST', {id: 'w_coop_win'}); console.log('weekly not done', r.body.error);
try { E.validateNativeWorld(world); console.log('validate after coop+duels+quests: OK'); } catch (e) { console.log('VALIDATION FAILED:', e.message); }
