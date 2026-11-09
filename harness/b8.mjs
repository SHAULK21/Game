import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
const mk = (id, name, type, lvl, rar) => ({id, templateId: id, name, type, rarity: rar, level: lvl, upgradeLevel: 0, stats: {defense: 10 + lvl}, icon: '?', sellPrice: 10, disassembleYield: {}, stackCount: 1});
save.player.inventory.push(mk('a1', 'Кожаный доспех странника', 'armor', 5, 'common'), mk('a2', 'Латный доспех рыцаря', 'armor', 12, 'rare'), mk('a3', 'Доспех пепельного клана', 'armor', 14, 'epic'),
  mk('h1', 'Шлем дозорного', 'helmet', 10, 'rare'), mk('h2', 'Шлем пустынника', 'helmet', 30, 'epic'), mk('b1', 'Сапоги охотника', 'boots', 4, 'common'), mk('b2', 'Сапоги ветра', 'boots', 9, 'uncommon'));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains","reg_whisper_woods","reg_forgotten_crypt","reg_forest"]';
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
console.log('bridge equip', await p.evaluate(() => typeof window.__aethBridge?.equipItem));
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1500);
console.log('icons', await p.evaluate(() => ['a1', 'a2', 'a3', 'h1', 'h2', 'b1', 'b2'].map(id => { const i = document.querySelector(`[data-inventory-item="${id}"] img`); return id + ':' + (i?.getAttribute('src') || '').split('/').slice(-2).join('/') + (i?.style.filter ? ' ' + i.style.filter : ''); }).join('  ')));
await p.screenshot({path: `b8-bag-${style}.png`});
console.log(await p.evaluate(() => window.__aethBridge.player.inventory.filter(i => /^[ahb]\d$/.test(i.id)).map(i => i.id + '=' + i.name + '/' + i.type + '/' + i.level).join('; ')));
if (!(await p.locator('[data-equipment-slot="helmet"]').count())) { for (const t of ['Герой', 'Персонаж']) { const b = p.locator('nav button', {hasText: t}).first(); if (await b.count()) { await b.click(); break; } } await p.waitForTimeout(1200); }
console.log('slots', await p.locator('[data-equipment-slot]').count());
if (style==='modern') { await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1000); }
await p.evaluate(() => document.querySelector('[data-equipment-slot="helmet"], [data-modern-equipment-slot="helmet"]').click()); await p.waitForTimeout(800); await p.locator('.ae-panel').screenshot({path: `b8-picker-${style}.png`});
await p.locator('.ae-equip-row.is-locked').first().click(); await p.waitForTimeout(600); console.log('locked toast', await p.locator('.ae-toast').innerText().catch(() => ''));
await p.locator('.ae-equip-row:not(.is-locked)').first().click(); await p.waitForTimeout(1000);
console.log('equipped helmet', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.equipped.helmet?.name, key), 'panel open', await p.locator('.ae-panel').count());
await p.evaluate(() => document.querySelector('[data-equipment-slot="gloves"], [data-modern-equipment-slot="gloves"]').click()); await p.waitForTimeout(700); console.log('empty picker:', (await p.locator('.ae-panel').innerText()).replace(/\n/g, ' ').slice(0, 160)); await p.keyboard.press('Escape');
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(800); await p.locator('[data-inventory-item]').first().click(); await p.waitForTimeout(1000); await p.screenshot({path: `b8-item-${style}.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1500);
if (style === 'fantasy') { const l = p.getByRole('button', {name: /Земли/}).first(); if (await l.count()) await l.click().catch(() => {}); await p.waitForTimeout(800); }
console.log('land icons', await p.evaluate(() => [document.querySelectorAll('main img.ae-land-icon').length, document.querySelectorAll('main .atlas-node img[src$="bestiary.webp"]').length]));
for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 800); await p.waitForTimeout(300); } await p.screenshot({path: `b8-lands-${style}.png`});
await s.close();
