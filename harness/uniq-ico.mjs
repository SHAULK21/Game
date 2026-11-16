import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 33, classId: 'archer', royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__aeTestUnique()); await p.waitForTimeout(150); }
await p.evaluate(() => window.__aethOpen.collection()); await p.waitForTimeout(800);
await p.evaluate(() => [...document.querySelectorAll('.ae-panel .ae-tab')][1]?.click()); await p.waitForTimeout(400);
await p.evaluate(() => { document.querySelectorAll('.ae-coll-set').forEach(d => { if (/Песчаных|Золотой/.test(d.textContent)) d.open = true; }); document.querySelector('.ae-coll-row.is-got')?.scrollIntoView({block: 'center'}); }); await p.waitForTimeout(600);
console.log('IMGS', await p.evaluate(() => [...document.querySelectorAll('.ae-coll-ic img')].map(i => i.src.split('/').pop() + ':' + i.naturalWidth).join(' ')));
await p.screenshot({path: 'uniq-ico-coll.png'});
await p.evaluate(() => document.querySelector('.ae-x')?.click()); await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Сумка/.test(b.textContent))?.click()); await p.waitForTimeout(2000);
await p.evaluate(() => { const i = [...document.querySelectorAll('main img')].find(i => /items\/uniq\//.test(i.src)); i?.scrollIntoView({block: 'center'}); }); await p.waitForTimeout(500);
console.log('BAGIMG', await p.evaluate(() => [...document.querySelectorAll('main img')].filter(i => /items\/uniq\//.test(i.src)).length));
await p.screenshot({path: 'uniq-ico-bag.png'}); await s.close(); process.exit(0);
