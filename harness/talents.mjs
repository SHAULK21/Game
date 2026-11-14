import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 62; save.player.talentPoints = 40; save.player.talents = []; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 62;
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

await p.locator('.ae-x').first().click({force: true}).catch(() => {}); await p.waitForTimeout(500);
for (let k = 0; k < 2; k++) { await p.evaluate(x => { const e = [...document.querySelectorAll('nav button, nav a, footer button')].find(n => n.textContent.trim() === x); e?.click(); }, 'Ещё'); await p.waitForTimeout(1800); }
await p.locator('button', {hasText: 'Воин · Ур.'}).first().click({force: true}).catch(e => console.log('nohero')); await p.waitForTimeout(1500);
console.log('NAV', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].map(e => e.textContent.trim())))); console.log('HERO:', (await p.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 600));
const t = p.locator('button, a', {hasText: /Талант/}).first(); await p.screenshot({path: 'talents-pre.png'}); console.log('BTNS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button,a')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 80)))); console.log('talent btn', await t.count()); await t.click({force: true}); await p.waitForTimeout(1500);
for (const br of ['Боевой ритм', 'Мастерство · с 50']) { await p.locator('button', {hasText: br}).first().click({force: true}); await p.waitForTimeout(700);
  for (const r of await p.locator('button', {hasText: /^Уровни/}).all()) { await r.click({force: true}).catch(() => {}); await p.waitForTimeout(200); }
  console.log('BR', br, (await p.locator('main').innerText()).replace(/\n+/g, ' | ').split('Нажмите на диапазон')[1]?.slice(0, 2200));
  await p.screenshot({path: `talents-${br.slice(0, 5)}.png`}); }
const m = p.locator('button', {hasText: /Изучить/}).first(); await m.click({force: true}); await p.waitForTimeout(500);
console.log('after learn', (await p.locator('main').innerText()).match(/Свободно: \d+/)?.[0]);
await s.close();
