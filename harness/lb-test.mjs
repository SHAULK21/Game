import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const base = w.tables.players[0]; for (let i = 1; i <= 4; i++) w.tables.players.push({...base, telegram_id: 9000 + i, character_name: 'Тест' + i, level: 10 - i, arena_rating: 1000 - i}); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Меню/.test(b.textContent))?.click()); await p.waitForTimeout(1000);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Рейтинг/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(3000);
console.log('ROWS', await p.evaluate(() => { const rows = [...document.querySelectorAll('main .rounded-xl.border.p-3')]; return rows.length + ' trophies: ' + rows.map(r => r.querySelector('svg.w-5') ? 'T' : '-').join(''); }));
await p.screenshot({path: 'lb.png'}); await s.close(); process.exit(0);
