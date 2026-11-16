import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const st = process.argv[2] || 'fantasy';
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Ещё|Меню/.test(b.textContent))?.click()); await p.waitForTimeout(2000);
await p.evaluate(() => (document.querySelector('[data-ae-entry]') || document.querySelector('[data-ae-group]'))?.scrollIntoView({block: 'start'})); await p.waitForTimeout(800);
console.log('ICONS', await p.evaluate(() => [...document.querySelectorAll('.ae-ui-ico')].map(e => e.dataset.aeIco).join(',')));
await p.screenshot({path: 'ico-' + st + '.png'}); await s.close(); process.exit(0);
