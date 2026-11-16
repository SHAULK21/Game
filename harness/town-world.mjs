import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', which = process.argv[3] || 'both';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 30, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete pl.firstJourney; delete pl.firstJourneyDeparture;
if (process.env.REAL) { const d = new Date().toLocaleDateString('sv'); ls['aeth_place_seen_437290420'] = JSON.stringify(Object.fromEntries(['market','quests','crafting','forge','alchemy','arena','clan','pets','barracks','chat','fishing','mine'].map(k => [k, d])));
  pl.miningExpedition = {endsAt: Date.now() - 6e4, startedAt: Date.now() - 36e5}; pl.currentRegionId = 'reg_swamp'; }
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; if (process.env.SCALE) ls.aeth_ui_scale = process.env.SCALE; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.players.find(p => p.telegram_id == 437290420).level = 30;
  if (process.env.REAL) { const iso = t => new Date(t).toISOString(), now0 = Date.now(); w.tables.clans = [{id: 'c1', tag: 'STR', name: 'Стражи', owner_telegram_id: 437290420, level: 4, xp: 300, max_members: 30, raid_hp: 12000, raid_max_hp: 12000, raid_reset_at: iso(now0 + 5 * 864e5), treasury_gold: 50000, treasury_silver: 0, treasury_ore: 0}];
    w.tables.clan_members = [{clan_id: 'c1', telegram_id: 437290420, role: 'owner', joined_at: iso(now0 - 9e8)}]; } }});
const p = s.page; await p.setViewportSize({width: +(process.env.W || 390), height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => document.querySelector('.ae-pop-x, .ae-apk-gift button[aria-label=Закрыть]')?.click());
console.log('PLACESEEN', await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('aeth_place_seen_437290420') || '{}')).length));
console.log('CLANX', await p.evaluate(async () => { const r = await window.__aethBridge.api('/api/ae-clanx').catch(e => ({err: String(e)})); return JSON.stringify({clan: !!r.clan, today: (r.today || []).map(x => x.k), err: r.err}); }));
const shoot = async (name, n) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  console.log(name.toUpperCase(), (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 2500));
  const H = await p.evaluate(() => document.documentElement.scrollHeight); console.log(name, 'pageH', H);
  for (let i = 0; i < n; i++) { await p.screenshot({path: `tw-${name}-${style}-${i}.png`}); await p.evaluate(() => window.scrollBy(0, 700)); await p.waitForTimeout(500); } };
const nav = t => p.evaluate(t => [...document.querySelectorAll('nav button, nav a')].find(b => b.textContent.includes(t))?.click(), t);
if (which !== 'world') { await nav('Поселение'); await p.waitForTimeout(2000); await shoot('town', 4); }
if (which !== 'town') { await nav('Мир'); await p.waitForTimeout(2500); await shoot('world', 5); }
if (which === 'world') { const r = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-ae-world-hint] button')].find(x => x.textContent === 'Выбрать'); b?.click(); return !!b; }); await p.waitForTimeout(2500);
  console.log('AFTER-SELECT', r, (await p.evaluate(() => (document.querySelector('.region-dispatch h3, .world-current h2, [role=dialog] h2, .bottom-sheet-backdrop h2')?.textContent || '') + ' | dialog=' + !!document.querySelector('[role=dialog], .bottom-sheet-backdrop') + ' | hint=' + !!document.querySelector('[data-ae-world-hint]'))));
  await p.screenshot({path: `tw-world-${style}-select.png`}); }
await s.close(); process.exit(0);
