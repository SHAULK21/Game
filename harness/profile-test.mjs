import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const [id, c, l] of [[437290420, 'warrior', 25], [2, 'mage', 12]]) { pool.ensurePlayer({id, displayName: 'P' + id}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {level: l, class_id: c, character_name: id === 2 ? 'Борис' : 'Админ'}); }
const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
let r = await call(437290420, '/api/horde/start', 'POST', {}); let v = r.body.run;
while (v.status === 'active') v = (await call(437290420, '/api/horde/act', 'POST', {action: 'attack', steps: 6})).body.run;
await call(437290420, '/api/horde/claim', 'POST', {});
r = await call(437290420, '/api/ae-profile'); console.log('earned:', r.body.titles.filter(t => t.earned).map(t => t.name).join(', '));
console.log('progress sample:', r.body.titles.filter(t => !t.earned).slice(0, 3).map(t => `${t.name} ${t.progress}/${t.need}`).join(' | '));
console.log('equip unearned:', (await call(437290420, '/api/ae-profile/title', 'POST', {id: 'immortal'})).body.error);
r = await call(437290420, '/api/ae-profile/title', 'POST', {id: 'veteran'}); console.log('equip:', r.body.profile.title?.name);
r = await call(437290420, '/api/ae-profile/avatar', 'POST', {id: 'gladiator_3'}); console.log('avatar:', r.body.profile.avatar.src);
console.log('bad avatar:', (await call(437290420, '/api/ae-profile/avatar', 'POST', {id: 'x'})).body.error);
r = await call(2, '/api/ae-profile/card?id=437290420'); console.log('Boris sees:', JSON.stringify(r.body.profile));
r = await call(2, '/api/ae-profile/batch', 'POST', {ids: ['437290420', '2']}); console.log('batch:', JSON.stringify(r.body.profiles));
try { E.validateNativeWorld(world); console.log('validate OK'); } catch (e) { console.log('VALIDATION FAILED', e.message); }
