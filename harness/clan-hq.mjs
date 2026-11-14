import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14;
  const cid = 'clan-test', st = new Date().toISOString(); (w.tables.clans ||= []).push({id: cid, tag: 'STR', name: 'Стражи Света', description: '', owner_telegram_id: 437290420, level: 2, xp: 0, max_members: 30, raid_hp: 12000, raid_max_hp: 12000, raid_reset_at: new Date(Date.now() + 5 * 864e5).toISOString(), created_at: st, updated_at: st, treasury_gold: 0, treasury_silver: 0, treasury_ore: 0, recruitment_open: true, min_join_level: 1, projects: {}});
  (w.tables.clan_members ||= []).push({clan_id: cid, telegram_id: 437290420, role: 'owner', joined_at: st, raid_damage: 0, last_raid_attack: null}, {clan_id: cid, telegram_id: 555, role: 'recruit', joined_at: st, raid_damage: 2400, last_raid_attack: null});
  for (const id of [437290420, 555]) w.tables.players.find(p => p.telegram_id == id).clan_id = cid;
  new E.NativePool(w, () => Date.now()).ensurePlayer({id: 556, displayName: 'Вика'}); Object.assign(w.tables.players.find(p => p.telegram_id == 556), {character_name: 'Вика', level: 12, class_id: 'mage', referred_by: '437290420'});
  w.tables.players.find(p => p.telegram_id == 555).referred_by = '437290420'; w.tables.players.find(p => p.telegram_id == 555).level = 6; (w.tables.referral_rewards ||= []).push({invitee: 556, inviter: '437290420', created_at: st}); (w.tables.friendships ||= []).push({pair: '437290420:556', a: '437290420', b: '556', requester: '437290420', status: 'accepted', created_at: st, updated_at: st}); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
const dismissStory = async () => { const b = p.locator('.ae-story button'); if (await b.count()) { await b.click(); await p.waitForTimeout(400); } };
await dismissStory(); await p.waitForTimeout(4000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.evaluate(() => document.querySelector('[data-settlement-place="clan"]').click()); await p.waitForTimeout(3000);
console.log('hq btn:', await p.locator('[data-ae-clan-hq]').innerText().catch(() => 'NONE'), '| strike:', await p.locator('button[data-ae-raid]').innerText().catch(() => 'NONE'));
await p.locator('[data-ae-clan-hq]').click(); await p.waitForTimeout(1500);
await p.screenshot({path: `clan-hq-${style}.png`});
console.log('HQ:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 900));
await p.locator('.ae-panel button', {hasText: 'Открыть'}).click(); await p.waitForTimeout(1200);
console.log('gold after chest:', (await P()).gold, '| chest btn now:', await p.locator('.ae-hq-chest').innerText().then(t => t.replace(/\n/g, ' ')));
for (const t of ['Вклад', 'Рейтинг', 'Заявки']) { await p.locator('.ae-tab', {hasText: t}).click({force: true}); await p.waitForTimeout(1000); console.log(t, '→', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 300)); }

console.log('meta:', JSON.stringify(s.world.tables.ae_clan_meta));
await p.locator('.ae-x').click().catch(() => {}); await p.waitForTimeout(400);
await p.locator('button[data-ae-raid]').click({force: true}); await p.waitForTimeout(2000);
await p.screenshot({path: `clan-raid-${style}.png`});
console.log('raid view:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
for (let i = 0; i < 14; i++) { const b = p.locator('.ae-panel button', {hasText: /^Атака$/}); if (!(await b.count())) break; await b.first().click({force: true}); await p.waitForTimeout(450); }
console.log('raid end:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
await p.screenshot({path: `clan-raid-end-${style}.png`});
const g0 = (await P()).gold; await p.locator('.ae-panel button', {hasText: 'Забрать и вернуться'}).click({force: true}); await p.waitForTimeout(2500);
console.log('gold +', (await P()).gold - g0, '| clan raid hp', s.world.tables.clans[0].raid_hp, '| member dmg', s.world.tables.clan_members[0].raid_damage);
await p.evaluate(() => window.__aethOpen.clanSearch()); await p.waitForTimeout(1200);
console.log('search:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
console.log(s.log.filter(l => /pageerror|ae clan/.test(l)).slice(0, 5).join('\n'));
await s.close();
