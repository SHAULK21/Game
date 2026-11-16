import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => window.__aethOpen.promoAdmin()); await p.waitForTimeout(1500);
await p.fill('.ae-panel input[placeholder^="Где"]', 'TikTok · ролик №4'); await p.fill('.ae-panel input[placeholder^="Свой код"]', 'TT-ZEMLI');
await p.evaluate(() => [...document.querySelectorAll('.ae-panel button')].find(b => /Создать код/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
const s2 = s; console.log('CODES', JSON.stringify((s2.world.tables.promo_codes || []).filter(c => c.source).map(c => c.code + ' ' + c.usesLeft)));
await p.evaluate(() => document.querySelector('.ae-src-card')?.scrollIntoView({block: 'center'})); await p.waitForTimeout(400);
console.log('PANEL', (await p.evaluate(() => document.querySelector('.ae-src-card')?.innerText || 'none')).replace(/\n+/g, ' | '));
await p.screenshot({path: 'promo-ui.png'}); await s.close(); process.exit(0);
