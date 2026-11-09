import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 20, miningLevel: 16, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
const mat = (name, n, i) => ({id: 'pm' + i, templateId: 'mat_x' + i, name, type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '💠', stats: {}, sellPrice: 5, disassembleYield: {}, stackCount: n});
save.player.inventory.push(mat('Мифриловая руда', 10, 1), mat('Арканная пыль', 8, 2), mat('Магическая эссенция', 4, 3));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(3000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{});
await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.getByRole('button', {name: /^Спутники/}).first().click(); await p.waitForTimeout(1200);
const btns = p.getByRole('button', {name: /Создать питомца/}); const n = await btns.count(); let clicked = false;
for (let i = 0; i < n; i++) if (!(await btns.nth(i).isDisabled())) { await btns.nth(i).click(); clicked = true; break; }
await p.waitForTimeout(1000);
const r = await p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return {crafted: x.craftedPetIds, mats: x.inventory.filter(i => /Мифрил|Арканн|Магическая/.test(i.name)).length}; }, key);
console.log(style, 'clicked', clicked, JSON.stringify(r), '| msg:', ((await p.innerText('body')).match(/(Создан[^\n]*|Не хватает[^\n]*|Нужен[^\n]*)/) || [''])[0]);
await s.close();
