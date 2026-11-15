import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 81, royalBriefingStep: 99, worldPlace: 'settlement', arenaTickets: 10}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button, main button')].find(b => /^Арена/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2000);
console.log('LIST', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').match(/Доступные соперники.{0,700}/)?.[0]);
const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].filter(b => /Сразиться|В бой|Бой/.test(b.textContent)); b[2]?.click(); return b.length; }); console.log('BTNS', ok);
await p.waitForTimeout(4000);
console.log('SCENE', await p.evaluate(() => (document.querySelector('.ae-sc-info.is-foe')?.innerText || 'none').replace(/\n+/g, ' | ')), JSON.stringify(await p.evaluate(() => { const c = window.__aethBridge?.combat; return c ? {m: c.monster?.name, lv: c.monster?.level, hp: c.monster?.maxHp, atk: c.monster?.attack, def: c.monster?.defense, mag: c.monster?.magicAttack, keys: Object.keys(c.monster||{}).join(",")} : null; })));
await p.screenshot({path: 'arena-lv.png'}); await s.close(); process.exit(0);
