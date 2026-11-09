import fs from 'node:fs';
const E = await import('../tgcloud/lib/gameEngine.js');
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const CS = JSON.parse(fs.readFileSync('class-skills.json'));
const world = JSON.parse(fs.readFileSync('world-after-reg.json'));
new E.NativePool(world, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
Object.assign(world.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 30, class_id: 'mage'});
Object.assign(world.tables.players.find(p => p.telegram_id == 437290420), {level: 30, class_id: 'warrior', character_name: 'Админ'});
const call = async (uid, path, method = 'POST', body = {}) => { const user = {id: uid, displayName: 'U', username: 'u'}, now = Date.now();
  const native = sub => E.handleProgressRequest(world, sub, user, {now: () => now, isAdmin: () => false});
  return (await handleSocialRequest(world, {path, method, body}, {...user, isAdmin: false}, now, native)) || await native({path, method, body}); };
const kit = cls => ({skills: CS[cls].map(s => ({id: s.id, name: s.name, icon: s.icon, mana: s.manaCost, mult: s.damageMultiplier, type: s.type, inflicts: s.inflicts})), talents: {skillManaReturn: 2}});
await call(555, '/api/ae-stats', 'POST', {stats: {maxHp: 1800, attack: 260, defense: 70, critChance: 15, maxMp: 400, kit: kit('mage')}});
let r = await call(437290420, '/api/duel/start', 'POST', {name: 'Борис', stats: {maxHp: 2400, attack: 230, defense: 120, critChance: 12, maxMp: 300, kit: kit('warrior')}});
console.log('duel me skills:', r.body.duel.me.skills.map(s => s.name + ':' + s.mana).join(', '), '| intent', r.body.duel.intent);
for (let i = 0; i < 40 && r.body.duel?.status === 'active'; i++) { const me = r.body.duel.me, sk = me.skills.find(s => s.mana <= me.mp && s.dmg > 0); r = await call(437290420, '/api/duel/act', 'POST', sk ? {action: 'skill', skillId: sk.id} : {action: 'guard'}); if (r.status >= 400) { console.log('err', r.body.error); break; } }
console.log('duel result', r.body.duel?.status, '\n ', r.body.duel?.log.slice(-6).map(l => l.text).join('\n  '));
r = await call(437290420, '/api/horde/start', 'POST', {stats: {maxHp: 2400, attack: 230, defense: 120, critChance: 12, maxMp: 300, kit: kit('warrior')}});
console.log('horde mp', r.body.run.mp, '/', r.body.run.maxMp);
for (let i = 0; i < 6; i++) { r = await call(437290420, '/api/horde/act', 'POST', {action: 'skill', skillId: i % 2 ? 'w_shatter' : 'w_strike'}); }
console.log('horde after skills mp', r.body.run.mp, 'kills', r.body.run.kills, '\n ', r.body.run.log.slice(-5).join('\n  '));
