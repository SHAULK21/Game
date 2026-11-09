import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
console.log('equipped', Object.entries(save.player.equipped || {}).map(([k, v]) => k + ':' + (v?.name || '-')).join(', '));
console.log('inv types', save.player.inventory.map(i => i.type + ':' + i.name).join(', ').slice(0, 900));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1200);
console.log(await p.evaluate(() => [...document.querySelectorAll('[data-equipment-slot]')].map(b => b.getAttribute('data-equipment-slot') + (b.disabled ? '(off)' : '') + ' imgs:' + [...b.querySelectorAll('img')].map(i => i.getAttribute('src')).join(',')).join('\n')));
const filled = p.locator('[data-equipment-slot]:not([disabled])').first();
if (await filled.count()) { await filled.click(); await p.waitForTimeout(900); await p.screenshot({path: `slot-click-${style}.png`}); console.log('dialog text:', (await p.locator('[role=dialog], .game-dialog-backdrop, .bottom-sheet-backdrop').first().innerText().catch(() => 'none')).slice(0, 300)); }
await s.close();
