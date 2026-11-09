import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 20, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains","reg_whisper_woods","reg_forest"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1200);
await p.screenshot({path: `w1-${style}.png`, fullPage: false});
const land = p.locator('main button', {hasText: /Ур\. 1 - 8|Ур\. 1–8|Пастбища/}).first(); await land.scrollIntoViewIfNeeded().catch(() => {}); 
console.log('land card html:', await land.evaluate(e => e.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 700)).catch(() => 'none'));
await p.screenshot({path: `w2-${style}.png`});
await land.click().catch(() => {}); await p.waitForTimeout(1200); await p.screenshot({path: `w3-${style}.png`});
const dlg = await p.evaluate(() => { const d = [...document.querySelectorAll('.fixed.inset-0, .game-dialog-backdrop, .bottom-sheet-backdrop')].pop(); return d ? {cls: d.className, h: d.firstElementChild?.getBoundingClientRect().height, inner: d.firstElementChild?.className} : null; });
console.log('mode window:', JSON.stringify(dlg));
await s.close();
