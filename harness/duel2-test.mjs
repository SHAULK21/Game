import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
const cls = ['warrior', 'mage', 'druid', 'rogue', 'knight', 'necromancer', 'berserker', 'assassin', 'hunter', 'paladin'];
cls.forEach((c, i) => { pool.ensurePlayer({id: i + 1, displayName: c}); Object.assign(world.tables.players.find(p => p.telegram_id == i + 1), {level: 20, class_id: c, character_name: c}); });
const call = (u, path, body) => handleSocialRequest(world, {path, method: 'POST', body}, {id: u}, now);
let wins = 0, total = 0, turns = 0, errs = new Set();
for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (a !== b) for (let k = 0; k < 3; k++) {
  let r = await call(a, '/api/duel/start', {targetId: b}); let d = r.body.duel;
  for (let t = 0; t < 60 && d.status === 'active'; t++) {
    const act = d.me.cd === 0 ? 'skill' : d.me.hp < d.me.maxHp * 0.35 && d.me.mp >= 25 ? 'heal' : /сильный|×3|×2/.test(d.intent) ? 'guard' : d.me.mp >= 20 ? 'power' : 'attack';
    r = await call(a, '/api/duel/act', {action: act}); if (r.status !== 200) { errs.add(r.body.error); r = await call(a, '/api/duel/act', {action: 'attack'}); } d = r.body.duel; now += 1000;
  }
  total++; turns += d.turn; if (d.status === 'won') wins++; await call(a, '/api/duel/claim', {});
}
console.log('duels', total, 'attacker win rate', Math.round(100 * wins / total) + '%', 'avg turns', (turns / total).toFixed(1), 'errors', [...errs]);
const d = world.tables.duels.at(-1); console.log(d.log.slice(-8).map(l => l.text).join('\n'));
