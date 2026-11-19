import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players[0]; const d = n => new Date(Date.now() - n * 864e5);
  [['Борис', 40, 'druid', 0], ['Вика', 12, 'mage', 2], ['Тихон', 5, 'rogue', 9]].forEach(([n, l, c, ago], i) => { w.tables.players.push({...me, telegram_id: 9600 + i, character_name: n, level: l, class_id: c, last_seen_at: d(ago).toISOString(), bot_started: i !== 2});
    for (let k = 0; k < 5 - i; k++) (w.tables.balance_activity ||= []).push({day: d(ago + k).toISOString().slice(0, 10), telegram_id: 9600 + i}); }); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(300); }
await p.evaluate(() => window.__aethOpen.stats()); await p.waitForTimeout(2500);
await p.evaluate(() => [...document.querySelectorAll('.ae-panel .ae-h3')].find(x => /Игроки/.test(x.textContent))?.scrollIntoView({block: 'start'})); await p.waitForTimeout(400);
console.log('ROSTER', (await p.evaluate(() => [...document.querySelectorAll('.ae-roster-row')].map(r => r.innerText.replace(/\n+/g, ' | ')).join(' ## '))).slice(0, 900));
await p.screenshot({path: `admin-roster-${process.argv[2] || 'modern'}.png`});
await s.close(); process.exit(0);
