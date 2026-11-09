// Server-only test of live.js: pet, weekend, raid, analytics.
import fs from 'node:fs';
const E = await import('../tgcloud/lib/gameEngine.js');
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const world = JSON.parse(fs.readFileSync('world-after-reg.json'));
const pool = new E.NativePool(world, () => Date.now());
for (const [id, n] of [[555, 'Борис'], [556, 'Вика']]) { pool.ensurePlayer({id, displayName: n}); Object.assign(world.tables.players.find(p => p.telegram_id == id), {character_name: n, level: 16, class_id: 'mage', bot_started: true, notification_settings: {enabled: true}, last_seen_at: new Date().toISOString()}); }
const me = world.tables.players.find(p => p.telegram_id == 437290420); Object.assign(me, {level: 20, bot_started: true, notification_settings: {enabled: true}});
const call = async (uid, path, method = 'GET', body = {}, now = Date.now()) => {
  const user = {id: uid, displayName: 'U' + uid, username: 'u' + uid};
  const native = sub => E.handleProgressRequest(world, sub, user, {now: () => now, isAdmin: id => id === E.ADMIN_TELEGRAM_ID});
  const r = (await handleSocialRequest(world, {path, method, body}, {...user, isAdmin: uid === E.ADMIN_TELEGRAM_ID}, now, native)) || await native({path, method, body});
  E.validateNativeWorld(world); return r;
};
let r = await call(437290420, '/api/ae-pet', 'POST', {local: {v: 30, t: Date.now() - 3600e3}});
console.log('pet get', r.status, JSON.stringify(r.body), world.tables.game_notifications.filter(n => n.category === 'pets').map(n => n.due_at));
r = await call(437290420, '/api/ae-pet', 'POST', {action: 'feed', how: 'bowl'}); console.log('pet feed', r.status, JSON.stringify(r.body), world.tables.game_notifications.filter(n => n.category === 'pets').length);
// weekend announce
r = await call(555, '/api/horde', 'GET', {}, Date.parse('2026-11-14T10:00:00Z')); console.log('weekend', JSON.stringify(r.body.weekend), 'announces', world.tables.game_notifications.filter(n => n.category === 'announcements').length);
r = await call(555, '/api/horde/start', 'POST', {}, Date.parse('2026-11-14T10:00:00Z')); console.log('weekend run blood', r.body.run?.blood, r.body.run?.weekend);
// clan
const cid = crypto.randomUUID(), st = new Date().toISOString();
(world.tables.clans ||= []).push({id: cid, tag: 'STR', name: 'Стражи Света', description: '', owner_telegram_id: 437290420, level: 1, xp: 0, max_members: 30, raid_hp: 1e4, raid_max_hp: 1e4, raid_reset_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_at: st, updated_at: st, treasury_gold: 0, treasury_silver: 0, treasury_ore: 0, recruitment_open: true, min_join_level: 1, projects: {}});
(world.tables.clan_members ||= []).push({clan_id: cid, telegram_id: 437290420, role: 'owner', joined_at: st, raid_damage: 0, last_raid_attack: null}, {clan_id: cid, telegram_id: 556, role: 'recruit', joined_at: st, raid_damage: 0, last_raid_attack: null});
for (const id of [437290420, 556]) world.tables.players.find(p => p.telegram_id == id).clan_id = cid;
const clan = world.tables.clans[0];
r = await call(437290420, '/api/ae-raid'); console.log('raid get', r.status, JSON.stringify(r.body).slice(0, 300));
r = await call(437290420, '/api/ae-raid/start', 'POST'); console.log('start', r.status, JSON.stringify(r.body.fight).slice(0, 200));
for (const a of ['attack', 'power', 'guard', 'attack', 'potion', 'attack']) { r = await call(437290420, '/api/ae-raid/act', 'POST', {action: a}); console.log(a, r.status, r.body.fight?.turn, r.body.fight?.hp, r.body.fight?.dealt, r.body.error || ''); }
console.log('result', JSON.stringify(r.body.fight?.result), 'raid hp', r.body.raid?.hp, 'top', JSON.stringify(r.body.raid?.top));
r = await call(437290420, '/api/ae-raid/start', 'POST'); console.log('second start', r.status, r.body.error);
// bring boss low to trigger notify
clan.raid_hp = 3000; r = await call(556, '/api/ae-raid/start', 'POST'); for (let i = 0; i < 6; i++) r = await call(556, '/api/ae-raid/act', 'POST', {action: 'attack'});
console.log('556 result', JSON.stringify(r.body.fight?.result), 'hp', clan.raid_hp, 'low flag', clan.ae_raid_low, 'outbox', (world.tables.telegram_outbox || []).map(o => o.payload.text.slice(0, 50)));
// kill
clan.raid_hp = 200; world.tables.clan_members.forEach(m => m.last_raid_attack = null);
r = await call(437290420, '/api/ae-raid/start', 'POST'); for (let i = 0; i < 6; i++) r = await call(437290420, '/api/ae-raid/act', 'POST', {action: 'attack'});
console.log('kill', JSON.stringify(r.body.fight?.result).slice(0, 200), 'hp', clan.raid_hp, 'treasury', clan.treasury_gold, 'xp', clan.xp);
// analytics
await call(437290420, '/api/ae-track', 'POST', {s: ['settlement:market', 'nav:Сумка', 'panel:Орда']}); await call(555, '/api/ae-track', 'POST', {s: ['panel:Орда']});
r = await call(437290420, '/api/ae-admin/stats'); console.log('stats', r.status, JSON.stringify(r.body).slice(0, 600));
r = await call(555, '/api/ae-admin/stats'); console.log('stats non-admin', r.status);
