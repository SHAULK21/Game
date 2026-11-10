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
const hit = async label => p.evaluate(l => { const b = [...document.querySelectorAll('.ae-panel button')].find(x => (x.textContent || '').trim().startsWith(l)); if (!b) return 'NO BUTTON ' + l; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${l}: ${r.top|0}px ${b === el || b.contains(el) ? 'OK' : 'COVERED by ' + el?.tagName + '.' + el?.className}`; }, label);
await p.locator('button[data-ae-raid]').click(); await p.waitForTimeout(2000);
console.log('panel:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 200));
for (const l of ['Атака', 'Навыки', 'Защита', 'Зелье', 'Отступить']) console.log(await hit(l));
await p.locator('.ae-panel button', {hasText: /^Атака$/}).first().click().catch(e => console.log('attack click fail', e.message.split('\n')[0]));
await p.waitForTimeout(1200); console.log('after attack:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 250));
await p.locator('.ae-panel button', {hasText: 'Навыки'}).first().click().catch(e => console.log('skills click fail', e.message.split('\n')[0]));
await p.waitForTimeout(800); console.log('skill menu:', await p.evaluate(() => document.querySelector('#combat-skills, .ae-skill-menu, [data-ae-skills]')?.innerText?.replace(/\n+/g, ' | ').slice(0, 300) || 'NONE'));
await p.screenshot({path: `raid-dbg-${style}.png`});
const sk = p.locator('.ae-panel [data-combat-skill]:not([disabled])').first();
if (await sk.count()) { await sk.click().catch(e => console.log('skill use fail', e.message.split('\n')[0])); await p.waitForTimeout(1200); console.log('after skill:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 300)); }
for (const a of ['Защита', 'Зелье', 'Атака', 'Навыки']) { const b = p.locator('.ae-panel button', {hasText: a}).first(); if (!(await b.count())) { console.log('no', a); continue; } await b.click().catch(e => console.log(a, 'fail', e.message.split('\n')[0])); await p.waitForTimeout(900);
  if (a === 'Навыки') { const k = p.locator('.ae-panel [data-combat-skill]:not([disabled])').last(); if (await k.count()) { await k.click().catch(e => console.log('sk fail', e.message.split('\n')[0])); await p.waitForTimeout(900); } }
  console.log(a, '→', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').match(/Ход \d+\/12|Урон по Стражу[^|]*/)?.[0], '| note:', await p.evaluate(() => document.querySelector('.ae-panel [role=status]')?.textContent?.slice(0, 120))); }
for (let i = 0; i < 14; i++) { const b = p.locator('.ae-panel button', {hasText: /^Атака$/}); if (!(await b.count())) break; await b.first().click().catch(() => {}); await p.waitForTimeout(500); }
console.log('end:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
await p.screenshot({path: `raid-dbg-end-${style}.png`});
console.log('calls:', s.calls.filter(c => /ae-clanx\/raid/.test(c.path)).map(c => c.path + ' ' + JSON.stringify(c.body || {})).join(' ; '));
console.log(s.log.filter(l => /pageerror|error/i.test(l)).slice(0, 6).join('\n'));
await s.close();
