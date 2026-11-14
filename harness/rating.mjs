import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14;
  const cid = 'clan-test', st = new Date().toISOString(); (w.tables.clans ||= []).push({id: cid, tag: 'STR', name: 'Стражи Света', description: '', owner_telegram_id: 437290420, level: 2, xp: 0, max_members: 30, raid_hp: 12000, raid_max_hp: 12000, raid_reset_at: new Date(Date.now() + 5 * 864e5).toISOString(), created_at: st, updated_at: st, treasury_gold: 0, treasury_silver: 0, treasury_ore: 0, recruitment_open: true, min_join_level: 1, projects: {}});
  (w.tables.clan_members ||= []).push({clan_id: cid, telegram_id: 437290420, role: 'owner', joined_at: st, raid_damage: 0, last_raid_attack: null}, {clan_id: cid, telegram_id: 555, role: 'recruit', joined_at: st, raid_damage: 2400, last_raid_attack: null});
  for (const id of [437290420, 555]) w.tables.players.find(p => p.telegram_id == id).clan_id = cid; (w.tables.ae_profiles ||= []).push({u: '437290420', apkSeen: new Date().toISOString()}, {u: '555', apkSeen: new Date().toISOString()});
  new E.NativePool(w, () => Date.now()).ensurePlayer({id: 556, displayName: 'Вика'}); Object.assign(w.tables.players.find(p => p.telegram_id == 556), {character_name: 'Вика', level: 12, class_id: 'mage', referred_by: '437290420'});
  w.tables.players.find(p => p.telegram_id == 555).referred_by = '437290420'; w.tables.players.find(p => p.telegram_id == 555).level = 6; (w.tables.referral_rewards ||= []).push({invitee: 556, inviter: '437290420', created_at: st}); (w.tables.friendships ||= []).push({pair: '437290420:556', a: '437290420', b: '556', requester: '437290420', status: 'accepted', created_at: st, updated_at: st}); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
const dismissStory = async () => { const b = p.locator('.ae-story button'); if (await b.count()) { await b.click(); await p.waitForTimeout(400); } };
await dismissStory(); await p.waitForTimeout(4000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});

await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(n => /Меню|Ещё/.test(n.textContent))?.click()); await p.waitForTimeout(1200);
await p.getByText('Рейтинг', {exact: true}).first().click().catch(e => console.log('no rating')); await p.waitForTimeout(5000);
await p.screenshot({path: `rating-${style}.png`});
console.log('CARD', await p.evaluate(() => { const els = [...document.querySelectorAll('[data-ae-uid]')]; const el = els[1] || els[0]; let c = el; for (let i = 0; i < 6 && c && !/^\s*\d/.test(c.innerText || ''); i++) c = c.parentElement; return c ? c.outerHTML.replace(/class="[^"]{60,}"/g, m => m.slice(0, 70) + '…"').slice(0, 1500) : 'none'; })); console.log('DOT', await p.evaluate(() => { const r = document.querySelector('.ae-nick-flexrow'); return [...r.children].map(c => c.tagName + '.' + String(c.className).slice(0, 60) + '[' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height) + ']').join(' | '); })); console.log('ROWS', await p.locator('.ae-nick-flexrow').count(), '| icons', await p.locator('.ae-app-ico').count());
await s.close();
