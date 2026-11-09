import fs from 'node:fs';
const E = await import('../tgcloud/lib/gameEngine.js');
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const world = JSON.parse(fs.readFileSync('world-after-reg.json'));
new E.NativePool(world, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
Object.assign(world.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'});
Object.assign(world.tables.players.find(p => p.telegram_id == 437290420), {level: 16, class_id: 'warrior', character_name: 'Админ'});
const call = async (uid, path, method = 'POST', body = {}) => { const user = {id: uid, displayName: 'U', username: 'u'}, now = Date.now();
  const native = sub => E.handleProgressRequest(world, sub, user, {now: () => now, isAdmin: () => false});
  const r = (await handleSocialRequest(world, {path, method, body}, {...user, isAdmin: false}, now, native)) || await native({path, method, body}); return r; };
const skill = {id: 'w_shatter', name: 'Сокрушение черепа', classId: 'warrior', levelReq: 6, manaCost: 40, cooldown: 4, damageMultiplier: 2.4, icon: '💥', inflicts: {type: 'bleed', chance: 0.8, duration: 3, power: 35}};
let r = await call(437290420, '/api/coop/create', 'POST', {dungeonId: 'goblin_cave', stats: {maxHp: 1200, attack: 160, defense: 60, critChance: 15, maxMp: 300}});
const roomId = r.body.room.id; await call(555, '/api/coop/join', 'POST', {roomId}); r = await call(437290420, '/api/coop/start');
console.log('start', r.status, 'foe', r.body.room?.foe?.name, 'stepsLeft', r.body.room?.foe?.stepsLeft, 'mp', r.body.room?.members?.map(m => m.mp + '/' + m.maxMp).join(' '));
let acts = 0, t0 = Date.now(), fails = {};
for (let i = 0; i < 400; i++) {
  const room = world.tables.coop_rooms.find(x => x.id === roomId);
  if (room.status !== 'active') break;
  if (room.phase === 'choose') { await call(i % 2 ? 555 : 437290420, '/api/coop/choose', 'POST', {optionId: room.options[0].id}); continue; }
  const who = i % 2 ? 555 : 437290420, m = room.members.find(x => String(x.id) === String(who));
  const body = who === 437290420 && !(m.cd?.w_shatter > 0) && m.mp >= 40 ? {action: 'skill', skill} : i % 7 === 0 ? {action: 'spell'} : {action: 'attack'};
  r = await call(who, '/api/coop/act', 'POST', body); acts++;
  if (r.status >= 400) fails[r.body.error] = (fails[r.body.error] || 0) + 1;
}
const room = world.tables.coop_rooms.find(x => x.id === roomId);
console.log('status', room.status, 'stage', room.stage, 'actions', acts, 'ms', Date.now() - t0, 'fails', JSON.stringify(fails));
console.log(room.log.slice(-12).map(l => l.text).join('\n'));
