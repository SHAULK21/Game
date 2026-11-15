import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14;
  const cid = 'clan-test', st = new Date().toISOString(); (w.tables.clans ||= []).push({id: cid, tag: 'STR', name: 'Стражи Света', description: '', owner_telegram_id: 437290420, level: 2, xp: 0, max_members: 30, raid_hp: 12000, raid_max_hp: 12000, raid_reset_at: new Date(Date.now() + 5 * 864e5).toISOString(), created_at: st, updated_at: st, treasury_gold: 0, treasury_silver: 0, treasury_ore: 0, recruitment_open: true, min_join_level: 1, projects: {}});
  (w.tables.clan_members ||= []).push({clan_id: cid, telegram_id: 437290420, role: 'owner', joined_at: st, raid_damage: 0, last_raid_attack: null}, {clan_id: cid, telegram_id: 555, role: 'recruit', joined_at: st, raid_damage: 2400, last_raid_attack: null});
  for (const id of [437290420, 555]) w.tables.players.find(p => p.telegram_id == id).clan_id = cid; w.tables.players.find(p => p.telegram_id == 555).progress_json = {player: {equipped: {weapon: {name: 'Клинок рассвета', templateId: 'x', type: 'weapon', rarity: 'epic', level: 18, upgradeLevel: 5, stats: {attack: 140, critChance: 4}, gems: ['fury', 'vamp'], icon: '⚔️'}, armor: {name: 'Кольчуга стража', type: 'armor', rarity: 'rare', level: 15, upgradeLevel: 2, stats: {defense: 60, maxHp: 120}, icon: '🛡️'}, helmet: {name: 'Шлем ветерана', type: 'helmet', rarity: 'legendary', level: 16, stats: {defense: 30}, gems: ['life'], icon: '⛑️'}, ring: {name: 'Кольцо удачи', type: 'ring', rarity: 'uncommon', level: 10, stats: {critChance: 3}}}}};
  (w.tables.ae_profiles ||= []).push({u: '437290420', apkSeen: new Date().toISOString()}, {u: '555', apkSeen: new Date().toISOString()});
  new E.NativePool(w, () => Date.now()).ensurePlayer({id: 556, displayName: 'Вика'}); Object.assign(w.tables.players.find(p => p.telegram_id == 556), {character_name: 'Вика', level: 12, class_id: 'mage', referred_by: '437290420'});
  w.tables.players.find(p => p.telegram_id == 555).referred_by = '437290420'; w.tables.players.find(p => p.telegram_id == 555).level = 6; (w.tables.referral_rewards ||= []).push({invitee: 556, inviter: '437290420', created_at: st}); (w.tables.friendships ||= []).push({pair: '437290420:556', a: '437290420', b: '556', requester: '437290420', status: 'accepted', created_at: st, updated_at: st}); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; if (process.env.APK) { await p.addInitScript(() => { const pref = {}; window.AethApk = {version: () => 6, versionName: () => '1.0.6', linked: () => true, saveLogin() {}, logout() {}, schedule() {}, cancel() {}, vibrate() {}, setPref: (k, v) => { pref[k] = v; }, getPref: (k, d) => k in pref ? pref[k] : d, keepAwake() {}, share() {}, copy() {}, paste: () => '', openExternal() {}, reload() {}}; localStorage.setItem('aeth_apk_gift_437290420', '1'); }); await p.reload(); } p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
const dismissStory = async () => { const b = p.locator('.ae-story button'); if (await b.count()) { await b.click(); await p.waitForTimeout(400); } };
await dismissStory(); await p.waitForTimeout(4000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});


await p.evaluate(() => window.__aethOpen.profile()); await p.waitForTimeout(2000);
console.log('LOOK', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 900));
for (const t of ['Серебряная', 'Зелёный', 'Тлеющие угли', 'Лес']) { await p.locator('.ae-look-opt', {hasText: t}).first().click().catch(e => console.log('no', t)); await p.waitForTimeout(700); }
await p.locator('.ae-panel input.ae-input').first().fill('Иду за драконом'); await p.locator('.ae-panel button', {hasText: 'Сохранить'}).first().click(); await p.waitForTimeout(800);
await p.locator('.ae-look-opt', {hasText: 'Новичок'}).first().click().catch(() => {}); await p.waitForTimeout(700);
console.log('SAVED', JSON.stringify(s.world.tables.ae_profiles.find(x => x.u === '437290420')?.look));
await p.screenshot({path: 'look-editor.png'});
await p.locator('.ae-x').first().click().catch(() => {}); await p.waitForTimeout(400);
await p.evaluate(() => window.__aethOpen.card('437290420', 'Админ')); await p.waitForTimeout(2000); await p.screenshot({path: 'look-card.png'});
await p.locator('.ae-x').first().click().catch(() => {}); await p.waitForTimeout(400);
await p.evaluate(() => window.__aethOpen.card('555', 'Борис')); await p.waitForTimeout(2000);
await p.locator('.ae-doll-slot', {hasText: ''}).first().click().catch(() => {}); await p.waitForTimeout(500);
console.log('CARD', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 700));
await p.locator('.ae-doll-wrap').scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({path: `card-gear-${style}.png`});
await s.close();
