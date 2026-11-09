import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 10, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
for (const [i, r] of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].entries()) save.player.inventory.push({id: 't' + i, templateId: 'x' + i, name: 'Меч ' + r + (i === 3 ? ' ★2' : ''), ascension: i === 3 ? 2 : undefined, type: 'weapon', rarity: r, level: 5 + i, upgradeLevel: i, stats: {attack: 10}, icon: '🗡️', sellPrice: 10, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1500);
const html = await p.evaluate(() => { const el = [...document.querySelectorAll('main button')].filter(b => b.querySelector('img') && /\+3/.test(b.textContent))[0]; return el ? el.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 1500) : 'not found'; });
console.log(html);
await p.locator('main').screenshot({path: `tiles-${style}.png`});
await s.close();
