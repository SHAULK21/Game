import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', apk = process.argv[3] === 'apk';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, energy: 40, maxEnergy: 100, lastEnergyRegenTimestamp: Date.now(), worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
if (apk) { await p.addInitScript(() => { const calls = []; window.__apkCalls = calls; const pref = {}; window.AethApk = {version: () => 3, versionName: () => '1.0.3', linked: () => true, saveLogin: v => calls.push(['saveLogin']), logout: () => calls.push(['logout']),
  schedule: (id, at, t, x) => calls.push(['schedule', id, Math.round((at - Date.now()) / 60000) + 'min', t]), cancel: id => calls.push(['cancel', id]), vibrate: ms => calls.push(['vibrate', ms]), setPref: (k, v) => { pref[k] = v; calls.push(['setPref', k, v]); },
  getPref: (k, d) => k in pref ? pref[k] : d, keepAwake: on => calls.push(['keepAwake', on]), share: t => calls.push(['share', t.slice(0, 40)]), copy: () => {}, paste: () => '', openExternal: u => calls.push(['open', u]), reload: () => {}}; }); await p.reload(); }
await p.waitForTimeout(12000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.locator('.ae-x').first().click().catch(() => {});
await p.evaluate(() => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => /Меню|Ещё/.test(n.textContent))?.click()); await p.waitForTimeout(1500);
const entry = p.getByText('Приложение Android').first(); console.log('menu entry:', await entry.count());
await entry.click().catch(e => console.log('click fail', e.message.slice(0, 80))); await p.waitForTimeout(1000);
console.log('panel:', (await p.locator('.ae-panel').innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ').slice(0, 420));
await p.screenshot({path: `apk-${style}-${apk ? 'apk' : 'tg'}.png`});
if (apk) { await p.locator('.ae-panel button', {hasText: 'Поделиться героем'}).click().catch(() => {}); await p.waitForTimeout(300);
  await p.evaluate(() => { try { Telegram.WebApp.HapticFeedback.impactOccurred('heavy'); } catch (e) {} });
  console.log('apk calls:', JSON.stringify(await p.evaluate(() => window.__apkCalls)).slice(0, 700)); }
await p.locator('.ae-x').first().click().catch(() => {}); await p.waitForTimeout(400);
await p.evaluate(() => window.__aethOpen?.uiScale ? window.__aethOpen.uiScale() : null);
await p.evaluate(() => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => /Меню|Ещё/.test(n.textContent))?.click()); await p.waitForTimeout(1200);
await p.locator('.ae-x').first().click().catch(() => {}); await p.evaluate(() => window.__aethOpen.ui()); await p.waitForTimeout(800);
console.log('UI panel:', (await p.locator('.ae-panel').innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ').slice(0, 300));
const other = (await p.evaluate(() => document.documentElement.getAttribute('data-interface'))) === 'modern' ? 'Фэнтези' : 'Современный';
await p.locator('.ae-panel button', {hasText: other}).click().catch(e => console.log('no style btn')); await p.waitForTimeout(4000);
console.log('style now:', await p.evaluate(() => document.documentElement.getAttribute('data-interface')), '| ls', await p.evaluate(() => localStorage.getItem('aethelgard_interface_style')));
await p.screenshot({path: 'apk-style-switch.png'});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
