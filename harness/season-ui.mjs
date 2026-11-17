import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', LV = +(process.env.LVL || 60);
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: LV, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players.find(p => p.telegram_id == 437290420); me.level = LV;
  w.tables.players.push({...me, telegram_id: 555, character_name: 'Борис', level: 12, last_seen_at: new Date().toISOString()}, {...me, telegram_id: 556, character_name: 'Вика', level: 70, last_seen_at: new Date().toISOString()});
  (w.tables.ae_season ||= []).push({s: 1, u: '437290420', pts: 1620, got: [], day: '', dayPts: 0}, {s: 1, u: '556', pts: 2400, got: [], day: '', dayPts: 0});
  if (LV >= 50) (w.tables.ae_mentors ||= []).push({id: 'mt1', m: '437290420', a: '555', status: 'pending', season: 1, at: new Date().toISOString(), gotA: [], gotM: []}); }});
const p = s.page; p.on('dialog', d => d.accept()); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(300); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Меню|Ещё/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
const open = async label => { const ok = await p.evaluate(l => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === l || x.querySelector('b')?.textContent.trim() === l); b?.click(); return !!b; }, label); await p.waitForTimeout(1800); return ok; };
console.log('SEASON entry', await open('Сезон 1'));
console.log('S', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | ').slice(0, 700));
await p.screenshot({path: `season-${style}-0.png`});
await p.evaluate(() => [...document.querySelectorAll('.ae-panel button')].find(b => b.textContent === 'Забрать')?.click()); await p.waitForTimeout(1500);
console.log('AFTERCLAIM', await p.evaluate(() => document.querySelectorAll('.ae-season-step.is-got').length));
await p.evaluate(() => [...document.querySelectorAll('.ae-panel .ae-tab')].find(b => /Рейтинг/.test(b.textContent))?.click()); await p.waitForTimeout(500); await p.screenshot({path: `season-${style}-top.png`});
await p.evaluate(() => document.querySelector('.ae-x')?.click()); await p.waitForTimeout(600);
let mo = await open('Наставничество'); if (!mo) { await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Меню|Ещё/.test(b.textContent))?.click()); await p.waitForTimeout(1200); mo = await open('Наставничество'); }
console.log('MENTOR entry', mo);
console.log('M', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | ').slice(0, 600));
await p.evaluate(() => [...document.querySelectorAll('.ae-panel button')].find(b => /Взять в ученики/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('M2', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | ').slice(0, 500));
await p.screenshot({path: `mentor-${style}.png`});
await s.close(); process.exit(0);
