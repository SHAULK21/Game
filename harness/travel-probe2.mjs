import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.getByRole('button', {name: /Отправиться в пещеру/}).first().click(); await p.waitForTimeout(1000);
if (style === 'fantasy') await p.getByRole('button', {name: 'Войти'}).first().click(); else { await p.locator('button', {hasText: 'Пещера летучих мышей'}).first().click(); await p.getByRole('button', {name: /Войти · 15/}).click(); }
for (let i=0;i<6;i++){ console.log('t', i*400, await p.evaluate(() => JSON.stringify({j: window.__aethBridge?.player?.worldJourney, bar: document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'), w: document.querySelector('.world-travel-overlay [style*=width], .travel-progress span')?.style.width, mine: document.querySelector('.ae-travel-pct')?.textContent}))); await p.waitForTimeout(400);} await p.screenshot({path: `travel-${style}.png`}); await p.waitForTimeout(1500); await p.screenshot({path: `travel2-${style}.png`});
console.log(await p.evaluate(() => { const o = document.querySelector('.world-travel-overlay, .fantasy-travel-overlay, [class*=travel]'); return o ? o.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 1600) : 'none'; }));
await s.close();
