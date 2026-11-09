import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
pool.ensurePlayer({id: 1, displayName: 'A'}); Object.assign(world.tables.players[0], {level: 20, class_id: 'mage', character_name: 'A'});
const call = (path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: 1}, now);
let r = await call('/api/horde/start', 'POST', {blood: true}); let v = r.body.run;
while (v.status === 'active') { v = (await call('/api/horde/act', 'POST', {action: 'attack', steps: 6})).body.run; }
console.log('second start before claim:', (await call('/api/horde/start', 'POST', {})).body.error);
console.log('claim', JSON.stringify((await call('/api/horde/claim', 'POST', {})).body.reward), 'again', (await call('/api/horde/claim', 'POST', {})).body.alreadyClaimed);
console.log('quests', (await call('/api/quests/special')).body.quests.filter(q => /horde/.test(q.id)).map(q => q.id + ' ' + q.progress + '/' + q.need).join(' | '));
try { E.validateNativeWorld(world); console.log('validate OK'); } catch (e) { console.log('VALIDATION FAILED', e.message); }
