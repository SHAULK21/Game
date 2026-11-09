import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 5, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1300);
await p.locator('[data-hunting-mode="mod_sanctuary"]').click(); await p.waitForTimeout(300);
const go = p.getByRole('button', {name: /Отправиться в путь/}); console.log('go visible', await go.isVisible());
await go.click(); await p.waitForTimeout(5000);
console.log('place', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.worldPlace + ' mode=' + JSON.parse(localStorage.getItem(k)).player.activeRegionModId, key));
console.log('dispatch height', await p.evaluate(() => document.querySelector('.region-dispatch')?.getBoundingClientRect().height));
await s.close();
