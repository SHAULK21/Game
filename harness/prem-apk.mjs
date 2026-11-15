import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 80, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.players.find(p => p.telegram_id == 437290420).premium_until = new Date(Date.now() + 9 * 864e5).toISOString(); }});
const p = s.page; await p.setViewportSize({width: 412, height: 870});
await p.addInitScript(() => { const pref = {}; window.AethApk = {version: () => 7, versionName: () => '1.0.7', linked: () => true, saveLogin() {}, logout() {}, schedule() {}, cancel() {}, vibrate() {}, setPref: (k, v) => { pref[k] = v; }, getPref: (k, d) => k in pref ? pref[k] : d, keepAwake() {}, share() {}, copy() {}, paste: () => '', openExternal() {}, reload() {}}; }); await p.reload();
await p.waitForTimeout(9000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.waitForTimeout(2500);
console.log('CHIP', await p.evaluate(() => { const c = document.querySelector('.ae-prem-chip'); return c ? c.textContent + ' in ' + c.parentElement.textContent.trim().slice(0, 40) + ' vis=' + !!c.offsetParent : 'none'; }), await p.evaluate(() => document.documentElement.className));
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Ещё|Меню/.test(b.textContent))?.click()); await p.waitForTimeout(1000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Шахта/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(3500);
console.log('SCROLLED', await p.evaluate(() => { const c = document.querySelector('.ae-prem-chip'); return c ? c.textContent + ' in ' + c.parentElement.textContent.trim().slice(0, 40) + ' vis=' + !!c.offsetParent : 'none'; }), await p.evaluate(() => !!document.querySelector('.is-compact')));
await p.screenshot({path: 'prem-apk.png', clip: {x: 0, y: 0, width: 412, height: 200}}); await s.close(); process.exit(0);
