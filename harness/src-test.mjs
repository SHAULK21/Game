import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Меню|Ещё/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
console.log('OPEN', await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^(Спутники|Питомцы)/.test(b.textContent.trim())); b?.click(); return b?.textContent.trim().slice(0, 30); })); await p.waitForTimeout(2000);
for (let k = 0; k < 3; k++) { await p.evaluate(() => [...document.querySelectorAll('main button, main [role=tab]')].find(b => /Создать|Создание|Крафт/.test(b.textContent) && !/питомца$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(800); }
await p.waitForTimeout(2500);
console.log('TXT', await p.evaluate(() => (document.querySelector('main')?.innerText||'').replace(/\n+/g,' | ').split('Драконит')[1]?.slice(0,300))); console.log('CHIPS', await p.evaluate(() => [...document.querySelectorAll('[data-ae-src]')].slice(0, 8).map(e => e.textContent.trim()).join(' | ')));
await p.evaluate(() => { const c = document.querySelector('[data-ae-src]'); c?.scrollIntoView({block: 'center'}); }); await p.waitForTimeout(400);
await p.screenshot({path: 'src-chips.png'});
await p.evaluate(() => [...document.querySelectorAll('[data-ae-src]')][1]?.click()); await p.waitForTimeout(800);
console.log('PANEL', (await p.evaluate(() => document.querySelector('.ae-src-pop')?.innerText || 'none')).replace(/\n+/g, ' | '));
await p.screenshot({path: 'src-panel.png'}); await s.close(); process.exit(0);
