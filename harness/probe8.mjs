import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, gold: 2000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains","reg_whisper_woods","reg_forgotten_crypt","reg_forest"]';
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844});
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1200);
await p.screenshot({path: `p8-bag-${style}.png`, fullPage: false});
console.log(await p.evaluate(() => { const x = [...document.querySelectorAll('main *')].filter(e => !e.childElementCount && /^Пусто$/.test(e.textContent.trim())).slice(0, 2); return x.map(e => { let c = e; for (let i = 0; i < 4; i++) c = c.parentElement; return c.outerHTML.slice(0, 700); }).join('\n\n'); }));
await p.locator('[data-inventory-item]').first().click(); await p.waitForTimeout(1200);
await p.screenshot({path: `p8-item-${style}.png`});
console.log(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => /Продать за|В чат|Продать другу/.test(b.textContent)).map(b => b.className + ' | ' + getComputedStyle(b).color + ' | ' + getComputedStyle(b).backgroundImage.slice(0, 80) + getComputedStyle(b).backgroundColor).join('\n')));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => { const e = [...document.querySelectorAll('main *')].find(e => !e.childElementCount && /^Пылающая пустыня/.test(e.textContent.trim())); if (!e) return 'no desert'; let c = e; for (let i = 0; i < 5; i++) c = c.parentElement; return c.outerHTML.slice(0, 1500); }));
await s.close();
