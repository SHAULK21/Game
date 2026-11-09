import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, energy: 20, lastEnergyRegenTimestamp: Date.now()}))); await p.waitForTimeout(300);
await p.locator('nav button').first().click(); await p.waitForTimeout(500);
if (style === 'fantasy') await p.locator('main button', {hasText: 'Таверна'}).first().click(); else { await p.locator('nav button').last().click(); await p.waitForTimeout(500); await p.getByRole('button', {name: /^Чат/}).first().click(); }
await p.waitForTimeout(1200);
const P = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return {energy: x.energy, intox: x.intoxication}; }, key);
console.log(style, 'before', JSON.stringify(await P()));
await p.locator('[data-ae-moonshine] button').click(); await p.waitForTimeout(600); console.log('after 1', JSON.stringify(await P()));
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, energy: 10}))); await p.waitForTimeout(200);
await p.locator('[data-ae-moonshine] button').click(); await p.waitForTimeout(600); console.log('after 2', JSON.stringify(await P()), 'toast:', await p.locator('.ae-toast').innerText());
const card = p.locator('[data-ae-moonshine]'); await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox(); await p.screenshot({path: `moon-${style}.png`, clip: {x: 0, y: Math.max(0, box.y - 160), width: 390, height: 300}});
await s.close();
