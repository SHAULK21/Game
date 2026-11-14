import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(400);
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(1200);
console.log('horde buttons:', (await p.locator('.ae-horde-go').allInnerTexts()).map(t => t.replace(/\n/g, ' ')).join(' | '));
await p.locator('.ae-horde-go').first().click(); await p.waitForTimeout(2500);
for (let i = 0; i < 4; i++) { for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.locator('.ae-bv button', {hasText: 'Атака'}).first().click({force: true}).catch(() => {}); await p.waitForTimeout(150); if (i === 1) await p.screenshot({path: 'fx-horde.png'}); await p.waitForTimeout(900); }
console.log('fx canvas:', await p.evaluate(() => !!document.querySelector('.ae-fx-canvas')));
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
