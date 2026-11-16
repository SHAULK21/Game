import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 10, classId: 'mage', royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const out = [];
for (let i = 0; i < 6; i++) { const it = await p.evaluate(() => window.__aeTestUnique()); out.push(it ? `${it.name} (${it.level} ${it.rarity} ${it.type}) ${JSON.stringify(it.stats)}` : 'null'); await p.waitForTimeout(200); }
console.log('DROPS\n' + out.join('\n'));
await p.evaluate(() => window.__aethOpen.collection()); await p.waitForTimeout(800);
console.log('PANEL', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 700));
await p.evaluate(() => [...document.querySelectorAll('.ae-panel .ae-tab')][1]?.click()); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('.ae-coll-row.is-got')?.scrollIntoView({block: 'center'})); await p.waitForTimeout(300);
await p.screenshot({path: 'uniq-' + (process.argv[2] || 'modern') + '.png'});
await p.evaluate(() => { document.querySelector('.ae-x')?.click(); }); await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Сумка/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('BAG', await p.evaluate(() => [...document.querySelectorAll('main *')].filter(e => !e.childElementCount && /Посох|Жезл|Перстень|Сапоги|Плащ|Накидка|Кольцо|Щит|Пояс|Медальон|Коса|Гримуар/.test(e.textContent)).map(e => e.textContent.trim()).slice(0, 6).join(' / ')));
await s.close(); process.exit(0);
