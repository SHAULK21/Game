import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
const U = [{id: 1, n: 'Танк', c: 'warrior'}, {id: 2, n: 'Друид', c: 'druid'}, {id: 3, n: 'Маг', c: 'mage'}];
for (const u of U) { pool.ensurePlayer({id: u.id, displayName: u.n}); Object.assign(world.tables.players.find(p => p.telegram_id == u.id), {level: 14, class_id: u.c, character_name: u.n, bot_started: true}); }
const call = async (u, path, method = 'GET', body) => { const r = await handleSocialRequest(world, {path, method, body}, u, now); E.validateNativeWorld(world); return r; };
let results = {won: 0, failed: 0}, events = new Set();
for (let run = 0; run < 20; run++) {
  let r = await call(U[0], '/api/coop/create', 'POST', {dungeonId: 'spider_den'}); const id = r.body.room.id;
  await call(U[1], '/api/coop/join', 'POST', {roomId: id}); await call(U[2], '/api/coop/join', 'POST', {roomId: id});
  r = await call(U[0], '/api/coop/start', 'POST'); let room = r.body.room, steps = 0;
  while (room.status === 'active' && steps < 3000) {
    if (room.phase === 'choose') { await call(U[1], '/api/coop/vote', 'POST', {optionId: room.options[0].id}); r = await call(U[0], '/api/coop/choose', 'POST', {optionId: room.options[Math.floor(Math.random() * room.options.length)].id}); room = r.body.room; continue; }
    for (const [i, u] of U.entries()) { const action = i === 1 ? 'heal' : (i === 0 && steps % 6 === 0 ? 'guard' : (steps % 5 === 0 ? 'power' : 'attack')); r = await call(u, '/api/coop/act', 'POST', {action}); if (r.body.room) room = r.body.room; }
    now += 2000; steps++;
  }
  results[room.status] = (results[room.status] || 0) + 1;
  for (const l of room.log) { if (/Карниз|Ловушка/.test(l.text)) events.add('trap'); if (/Тайник/.test(l.text)) events.add('treasure'); if (/Святилище/.test(l.text)) events.add('shrine'); if (/Засада/.test(l.text)) events.add('elite'); }
  for (const u of U) await call(u, '/api/coop/claim', 'POST'); for (const u of U) await call(u, '/api/coop/leave', 'POST');
}
console.log('20 runs:', JSON.stringify(results), 'events seen:', [...events].join(','));
const pulse = await call(U[1], '/api/social/pulse'); console.log('events for member:', pulse.body.events.length, pulse.body.events.slice(-3).map(e => e.icon + ' ' + e.text).join(' | '));
await call(U[1], '/api/social/events/ack', 'POST', {ids: pulse.body.events.map(e => e.id)}); console.log('after ack', (await call(U[1], '/api/social/pulse')).body.events.length);
console.log('choose by non-leader:', (await (async () => { const r = await call(U[0], '/api/coop/create', 'POST', {dungeonId: 'goblin_cave'}); await call(U[1], '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(U[0], '/api/coop/start', 'POST'); return 'ok'; })()));
// admin level
world.tables.players.find(p => p.telegram_id == 1).telegram_id = 437290420;
const adm = {id: 437290420, isAdmin: true}; console.log('admin level', JSON.stringify((await call(adm, '/api/admin/players/level', 'POST', {targetId: 3, level: 25})).body), 'non-admin', (await call(U[1], '/api/admin/players/level', 'POST', {targetId: 3, level: 99})).status);
console.log('target event', JSON.stringify((await call(U[2], '/api/social/pulse')).body.events.filter(e => e.kind === 'admin_level')));
const all = world.tables.coop_rooms.flatMap(r => r.log.map(l => l.text)).join('\n');
console.log('outcomes in full logs:', ['Карниз обрушился', 'Ловушка ранит', 'Тайник', 'Святилище', 'Засада', 'логово босса'].map(k => k + ':' + (all.split(k).length - 1)).join(' '));
const unacked = () => world.tables.ae_events.filter(e => e.to === '2' && !e.acked).length; const before = unacked();
for (let i = 0; i < 10 && unacked(); i++) { const p = await call(U[1], '/api/social/pulse'); await call(U[1], '/api/social/events/ack', 'POST', {ids: p.body.events.map(e => e.id)}); }
console.log('member unacked before', before, 'after acking all:', unacked());
