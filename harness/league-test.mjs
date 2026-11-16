import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 60, royalBriefingStep: 99, worldPlace: 'settlement', arenaRating: 5200, arenaLeague: 'Бронза'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.players.find(p => p.telegram_id == 437290420).arena_rating = 5200; }});
const p = s.page; await p.setViewportSize({width: 412, height: 870}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button, main button')].find(b => /^Арена/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(4000);
const gold0 = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /^aethelgard_save_v1_data_/.test(k)); return JSON.parse(localStorage.getItem(k)).player.gold; });
console.log('LABEL', await p.evaluate(() => [...document.querySelectorAll('main div')].find(e => /^Лига:\s/.test((e.textContent || '').trim()) && e.childElementCount <= 2)?.textContent), '| CARD', await p.evaluate(() => document.querySelector('[data-ae-league]')?.innerText.replace(/\n+/g, ' | ')));
await p.evaluate(() => document.querySelector('[data-ae-league]')?.scrollIntoView({block: 'center'})); await p.waitForTimeout(300); await p.screenshot({path: 'league-card.png'}); console.log('BADGES', await p.evaluate(() => [...document.querySelectorAll('main span')].filter(e => /^(Бронза|Серебро|Золото|Платина|Мастер)$/.test(e.textContent.trim())).map(e => e.textContent.trim()).join(',')));
await p.evaluate(() => document.querySelector('[data-ae-league]')?.click()); await p.waitForTimeout(2000);
console.log('PANEL', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | ').slice(0, 900));
await p.screenshot({path: 'league-panel.png'});
const gold1 = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /^aethelgard_save_v1_data_/.test(k)); const pl = JSON.parse(localStorage.getItem(k)).player; return pl.gold + ' tickets ' + pl.arenaTickets; });
console.log('GOLD', gold0, '->', gold1, '| server claimed', JSON.stringify(s.world.tables.ae_profiles?.find(x => x.u == '437290420')?.leagues));
await s.close(); process.exit(0);
