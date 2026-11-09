import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
const now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
const A = {id: 101, displayName: 'Алиса'}, B = {id: 202, displayName: 'Борис'}; pool.ensurePlayer(A); pool.ensurePlayer(B);
for (const p of world.tables.players) { p.bot_started = true; p.character_name = p.display_name; p.level = 7; }
const call = async (u, path, method = 'GET', body) => { const r = await handleSocialRequest(world, {path, method, body}, u, now) ?? await E.handleProgressRequest(world, {path, method, headers: {'x-game-reset-version': '0'}, body}, u, {now: () => now}); E.validateNativeWorld(world); return r; };
const show = async (l, p) => { const r = await p; console.log(l, r.status, JSON.stringify(r.body).slice(0, 220)); return r; };
await show('search', call(A, '/api/friends/search?q=бор'));
await show('request', call(A, '/api/friends/request', 'POST', {targetId: '202'}));
await show('B list', call(B, '/api/friends'));
await show('accept', call(B, '/api/friends/accept', 'POST', {targetId: '101'}));
await show('A list', call(A, '/api/friends'));
await show('dm', call(A, '/api/chat/private/202', 'POST', {text: 'Привет! Идём в подземелье?', clientMessageId: crypto.randomUUID()}));
await show('dm2', call(A, '/api/chat/private/202', 'POST', {text: 'ещё', clientMessageId: crypto.randomUUID()}));
await show('B contacts', call(B, '/api/chat/private/contacts'));
await show('self', call(A, '/api/friends/request', 'POST', {targetId: '101'}));
await show('remove', call(A, '/api/friends/remove', 'POST', {targetId: '202'}));
console.log('outbox', world.tables.telegram_outbox.map(o => o.payload.chat_id + ': ' + o.payload.text.replace(/\n/g, ' ')));
