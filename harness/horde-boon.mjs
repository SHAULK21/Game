import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, energy: 100, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players.find(p => p.telegram_id == 437290420); me.level = 30;
  const wk = '2026-11-16'; (w.tables.horde_week ||= []).push(...[['Мирослава', 84], ['Тихон', 71], ['Ярослав', 63]].map(([n, k], i) => { w.tables.players.push({...me, telegram_id: 9500 + i, character_name: n, level: 40 + i * 5}); return {w: wk, u: String(9500 + i), kills: k, at: new Date().toISOString()}; })); }});
const p = s.page; p.on('dialog', d => d.accept()); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(300); }
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(1500);
console.log('LOBBY', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 600));
await p.screenshot({path: `hb-${style}-lobby.png`});
await p.evaluate(() => [...document.querySelectorAll('.ae-horde-go')].find(b => /В Орду/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
for (let i = 0; i < 60; i++) { const has = await p.evaluate(() => !!document.querySelector('.ae-boon-pick')); if (has) break;
  await p.evaluate(() => [...document.querySelectorAll('.ae-bv button')].find(b => b.textContent.trim() === 'Атака')?.click()); await p.waitForTimeout(350); }
console.log('BOON', await p.evaluate(() => document.querySelector('.ae-boon-pick')?.innerText.replace(/\n+/g, ' | ') || 'none'));
await p.screenshot({path: `hb-${style}-boon.png`});
await p.evaluate(() => document.querySelector('.ae-boon')?.click()); await p.waitForTimeout(1200);
console.log('CHIPS', await p.evaluate(() => document.querySelector('.ae-boon-chips')?.children.length || 0), await p.evaluate(() => document.querySelector('.ae-boon-pick') ? 'still' : 'gone'));
await p.evaluate(() => [...document.querySelectorAll('.ae-bv button')].find(b => /Автобой/.test(b.textContent))?.click());
for (let i = 0; i < 120; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => !!document.querySelector('.ae-result'))) break; if (i === 8) await p.screenshot({path: `hb-${style}-auto.png`}); }
console.log('RESULT', (await p.evaluate(() => document.querySelector('.ae-result')?.innerText || 'none')).replace(/\n+/g, ' | '), '| chips', await p.evaluate(() => [...document.querySelectorAll('.ae-boon-chips span')].map(x => x.textContent).join('')));
console.log('ERR', s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join(' || ') || 'none');
await s.close(); process.exit(0);
