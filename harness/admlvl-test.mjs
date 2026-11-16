import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 40, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const lv = () => p.evaluate(() => { const k = Object.keys(localStorage).find(k => /^aethelgard_save_v1_data_/.test(k)); return JSON.parse(localStorage.getItem(k)).player.level; });
await p.waitForTimeout(4000); console.log('BEFORE', await lv(), 'cloud', s.world.__cloud?.['437290420']?.level);
console.log('ADMIN', JSON.stringify(await p.evaluate(async () => { try { return await window.__aethBridge.api('/api/admin/players/level', {method: 'POST', body: JSON.stringify({targetId: '437290420', level: 20})}); } catch (e) { return String(e); } })));
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(12000);
console.log('AFTER', await lv(), 'cloud', s.world.__cloud?.['437290420']?.level, 'server', s.world.tables.players.find(x => x.telegram_id == 437290420).level, 'dialog', await p.evaluate(() => !!document.querySelector('.ae-cloud')));
await s.close(); process.exit(0);
