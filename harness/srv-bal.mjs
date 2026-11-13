import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
const PROF = {none: null, avg: {maxHp: 4122, attack: 602, defense: 818, critChance: 25, critDamage: 160, maxMp: 500}, max: {maxHp: 6649, attack: 1758, defense: 1735, critChance: 45, critDamage: 250, maxMp: 600}};
const mk = async (n, prof) => { let now = 1.8e12; const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
  for (let i = 1; i <= n; i++) { pool.ensurePlayer({id: i, displayName: 'P' + i}); Object.assign(world.tables.players.find(p => p.telegram_id == i), {level: 45, class_id: i === 2 ? 'paladin' : 'warrior', character_name: 'P' + i}); }
  const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
  if (prof) for (let i = 1; i <= n; i++) { const r = await call(i, '/api/ae-stats', 'POST', {stats: prof}); if (r.status >= 300) console.log('stats fail', JSON.stringify(r.body)); }
  return {world, call, tick: ms => { now += ms; }, now: () => now}; };
async function horde(prof) { const w = await mk(1, prof); let r = await w.call(1, '/api/horde/start', 'POST', {blood: false}), v = r.body.run, n = 0;
  while (v.status === 'active' && n++ < 3000) { const a = v.hp < v.maxHp * 0.35 && v.potions ? 'potion' : v.powerCd === 0 ? 'power' : 'attack'; r = await w.call(1, '/api/horde/act', 'POST', {action: a, steps: 6}); v = r.body.run; w.tick(400); }
  return v.kills; }
async function coop(prof, dungeonId) { const w = await mk(2, prof);
  let r = await w.call(1, '/api/coop/create', 'POST', {dungeonId}); if (!r.body.room) return 'create:' + JSON.stringify(r.body).slice(0, 80); await w.call(2, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await w.call(1, '/api/coop/start', 'POST');
  const t0 = w.now(); let minHp = 1;
  for (let step = 0; step < 8000; step++) { w.tick(250);
    for (let u = 1; u <= 2; u++) { const room = (await w.call(u, '/api/coop/room')).body.room; if (!room) continue;
      if (room.status !== 'active') return `${room.status} ${Math.round((w.now() - t0) / 1000)}s stage ${room.stage} minHp ${Math.round(minHp * 100)}%`;
      if (room.phase === 'choose') { if (u === 1) await w.call(1, '/api/coop/choose', 'POST', {optionId: room.options[0].id}); continue; }
      const mine = room.members.find(m => m.id == u), cd = mine.cooldowns || {}; if (!mine.hp) { minHp = 0; continue; } minHp = Math.min(minHp, mine.hp / mine.maxHp);
      const low = room.members.filter(m => m.hp / m.maxHp < 0.4)[0];
      const act = low && !cd.heal ? 'heal' : !cd.spell ? 'spell' : !cd.power ? 'power' : !cd.attack ? 'attack' : null;
      if (act) await w.call(u, '/api/coop/act', 'POST', {action: act, targetId: act === 'heal' ? low.id : undefined}); } }
  return 'timeout'; }
for (const k of ['none', 'avg', 'max']) { const hs = []; for (let i = 0; i < 3; i++) hs.push(await horde(PROF[k])); hs.push(...hs, ...hs); hs.sort((a, b) => a - b);
  console.log(k.padEnd(5), 'horde kills min/med/max', hs[0], hs[4], hs[8]); }
