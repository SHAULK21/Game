import fs from 'node:fs';
const E = await import('../tgcloud/lib/gameEngine.js');
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const world = JSON.parse(fs.readFileSync('world-after-reg.json'));
Object.assign(world.tables.players.find(p => p.telegram_id == 437290420), {level: 29, class_id: 'paladin', character_name: 'Админ'});
const call = async (path, method = 'POST', body = {}) => { const user = {id: 437290420}, now = Date.now(); const native = sub => E.handleProgressRequest(world, sub, user, {now: () => now, isAdmin: () => true});
  return (await handleSocialRequest(world, {path, method, body}, {...user, isAdmin: true}, now, native)) || await native({path, method, body}); };
let r = await call('/api/horde', 'GET'); console.log('get', r.status, JSON.stringify(r.body.weekend), r.body.run?.status);
r = await call('/api/horde/start', 'POST', {blood: true}); console.log('start', r.status, r.body.error || '', 'blood', r.body.run?.blood, 'queue', r.body.run?.queue?.map(m => m.sprite + ':' + m.name).join(', '));
for (let i = 0; i < 5; i++) { r = await call('/api/horde/act', 'POST', {action: 'attack', steps: 3}); if (r.status >= 400) { console.log('act err', r.body.error); break; } }
console.log('act', r.status, 'kills', r.body.run?.kills, 'hp', r.body.run?.hp, '/', r.body.run?.maxHp, r.body.run?.log?.slice(-3).join(' | '));
