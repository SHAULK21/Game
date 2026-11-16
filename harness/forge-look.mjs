import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; save.player.gold = 50000; save.player.silver = 20000; Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const st = process.argv[2] || 'modern';
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Поселение/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll('main button, main [role=button]')].find(b => /Кузниц/.test(b.textContent))?.click()); await p.waitForTimeout(2500);
await p.evaluate(() => [...document.querySelectorAll('.ae-forge-tile')].find(b => /Щит|нагрудник/i.test(b.textContent))?.click()); await p.waitForTimeout(1200);
console.log('SEL', await p.evaluate(() => document.querySelector('main .selection-trigger')?.textContent.trim().slice(0, 60)), await p.evaluate(() => [...document.querySelectorAll('.ae-forge-tile')].map(t => t.innerText.replace(/\n/g, ' ')).join(' | ')));
const g0 = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /^aethelgard_save_v1_data_/.test(k)); return JSON.parse(localStorage.getItem(k)).player.gold; });
for (let i = 0; i < 3; i++) { await p.evaluate(() => [...document.querySelectorAll('main button')].find(b => /^Заточить до/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(900); }
console.log('UP', await p.evaluate(() => document.querySelector('main .selection-trigger')?.textContent.trim().slice(0, 60)), 'gold', g0, '->', await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /^aethelgard_save_v1_data_/.test(k)); return JSON.parse(localStorage.getItem(k)).player.gold; }));
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
console.log('TXT', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 2500));
for (let i = 0; i < 3; i++) { await p.screenshot({path: `forge-${st}-${i}.png`}); await p.evaluate(() => window.scrollBy(0, 700)); await p.waitForTimeout(400); }
await s.close(); process.exit(0);
