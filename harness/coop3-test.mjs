import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const [id, c] of [[1, 'warrior'], [2, 'druid']]) { pool.ensurePlayer({id, displayName: 'P' + id}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {level: 20, class_id: c, character_name: 'P' + id}); }
const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
const counts = {}; let r = await call(1, '/api/coop/create', 'POST', {dungeonId: 'goblin_cave'}); await call(2, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(1, '/api/coop/start', 'POST');
const room = world.tables.coop_rooms[0];
for (let i = 0; i < 300; i++) {
  room.status = 'active'; room.stage = 2; room.phase = 'choose'; room.options = [{id: ['corridor', 'ledge', 'grotto', 'bridge', 'glow', 'bones'][i % 6], name: 'x', icon: '', hint: ''}]; room.log = [];
  for (const m of room.members) m.hp = m.maxHp;
  await call(1, '/api/coop/choose', 'POST', {optionId: room.options[0].id});
  const t = room.log.map(l => l.text).join(' ');
  const k = /Засада/.test(t) ? 'elite' : /Враг:/.test(t) ? 'fight' : /обрушился/.test(t) ? 'fall' : /Ловушка/.test(t) ? 'trap' : /Тайник/.test(t) ? 'treasure' : /Святилище/.test(t) ? 'shrine' : 'other';
  counts[k] = (counts[k] || 0) + 1;
}
console.log('outcomes over 300 path choices:', JSON.stringify(counts));
console.log('non-leader choose:', (await call(2, '/api/coop/choose', 'POST', {optionId: 'x'})).body.error);
console.log('member events after:', world.tables.ae_events.filter(e => e.to === '2').length);
