import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
for (const [id, n, lvl, cls] of [[437290420, 'Админ', 18, 'paladin'], [555, 'Борис', 16, 'berserker'], [777, 'Вера', 4, 'mage']]) { pool.ensurePlayer({id, displayName: n}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {character_name: n, level: lvl, class_id: cls, bot_started: true}); }
const A = {id: 437290420, isAdmin: true}, B = {id: 555}, V = {id: 777};
const call = async (u, path, method = 'GET', body) => { const r = await handleSocialRequest(world, {path, method, body}, u, now); E.validateNativeWorld(world); return r; };
// duel by nickname
let r = await call(A, '/api/duel/start', 'POST', {name: 'борис'}); console.log('duel start', r.status, r.body.duel?.foe.name, r.body.duel?.me.hp, r.body.duel?.foe.hp);
let turns = 0; while (r.body.duel?.status === 'active' && turns < 60) { const d = r.body.duel; const act = d.me.hp < d.me.maxHp * 0.35 && d.me.mp >= 25 ? 'heal' : d.me.mp >= 40 ? 'power' : 'attack'; r = await call(A, '/api/duel/act', 'POST', {action: act}); turns++; }
console.log('duel end', r.body.duel.status, 'turns', turns, 'rating', r.body.duel.ratingChange, 'reward', JSON.stringify(r.body.duel.reward));
console.log(r.body.duel.log.slice(-3).map(l => l.text).join(' | '));
if (r.body.duel.reward) console.log('claim', JSON.stringify((await call(A, '/api/duel/claim', 'POST')).body), 'again', (await call(A, '/api/duel/claim', 'POST')).status);
console.log('duel info', JSON.stringify((await call(A, '/api/duel')).body).slice(0, 200));
console.log('bad nick', JSON.stringify((await call(A, '/api/duel/start', 'POST', {name: 'нетакого'})).body));
// pulse for Boris (got a duel + friend request + dm)
await call(A, '/api/friends/request', 'POST', {targetId: '555'});
await handleSocialRequest(world, {path: '/api/chat/private/555', method: 'POST', body: {text: 'Привет!', clientMessageId: crypto.randomUUID()}}, A, now) ?? await E.handleProgressRequest(world, {path: '/api/chat/private/555', method: 'POST', headers: {'x-game-reset-version': '0'}, body: {text: 'Привет!', clientMessageId: crypto.randomUUID()}}, A, {now: () => now});
console.log('pulse B', JSON.stringify((await call(B, '/api/social/pulse')).body));
// promo
console.log('non-admin gen', (await call(B, '/api/admin/promo', 'POST', {pack: 'starter'})).status);
r = await call(A, '/api/admin/promo', 'POST', {pack: 'premium1'}); const codes = r.body.codes.map(c => c.code); console.log('generated', codes.join(' '), 'uses', r.body.codes[0].usesLeft);
console.log('V low level', JSON.stringify((await call(V, '/api/promo/redeem', 'POST', {code: codes[0]})).body));
console.log('B redeem', JSON.stringify((await call(B, '/api/promo/redeem', 'POST', {code: codes[0].toLowerCase()})).body), 'premium_until', world.tables.players.find(p => p.telegram_id == 555).premium_until);
console.log('B again', JSON.stringify((await call(B, '/api/promo/redeem', 'POST', {code: codes[0]})).body));
const s2 = await call(A, '/api/admin/promo', 'POST', {pack: 'starter'}); const c2 = s2.body.codes[0].code;
for (const u of [A, B, V]) console.log('starter by', u.id, JSON.stringify((await call(u, '/api/promo/redeem', 'POST', {code: c2})).body));
pool.ensurePlayer({id: 888, displayName: 'X'}); world.tables.players.find(p => p.telegram_id == 888).level = 5;
console.log('4th use', JSON.stringify((await call({id: 888}, '/api/promo/redeem', 'POST', {code: c2})).body));
console.log('admin list', (await call(A, '/api/admin/promo')).body.codes.length);
