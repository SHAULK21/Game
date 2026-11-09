import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 10, silver: 20000, worldPlace: 'settlement', royalBriefingStep: 99}); delete pl.firstJourney; delete pl.firstJourneyDeparture;
const shield = {name: 'Щит новобранца', type: 'offhand', rarity: 'common', upgradeLevel: 0, stats: {defense: 12}, icon: '🛡️', sellPrice: 20, disassembleYield: {silver: 3}, stackCount: 1};
pl.inventory.push({...shield, id: 'loc-1', templateId: 'drop_баклер_наёмника', level: 2}, {...shield, id: 'loc-2', templateId: 'drop_тотем_камня', level: 4, stats: {defense: 18}, upgradeLevel: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const ring = {templateId: 'drop_кольцо_эхолокации', name: 'Кольцо эхолокации', type: 'ring', rarity: 'rare', level: 4, upgradeLevel: 0, stats: {critChance: 4, maxHp: 30}, icon: '💍', sellPrice: 60, disassembleYield: {silver: 8}};
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.owned_items = ['a1b2c3d4-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000002'].map(id => ({id, owner_telegram_id: 437290420, item_json: ring, quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, origin: 'game_command', created_at: new Date().toISOString()})); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5500);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1500);
const bb = p.locator('[data-ae-bag-merge]'); console.log(style, 'bag button', await bb.count(), JSON.stringify(await bb.innerText().catch(() => '')));
await bb.scrollIntoViewIfNeeded().catch(()=>{}); await p.screenshot({path: `bag-${style}.png`});
await bb.click(); await p.waitForTimeout(600); await p.screenshot({path: `bag-merge-${style}.png`});
console.log('groups:', (await p.locator('.ae-panel .ae-card b').allInnerTexts()).join(' | '));
const n = await p.getByRole('button', {name: /Объединить ·/}).count();
for (let i = 0; i < n; i++) { await p.getByRole('button', {name: /Объединить ·/}).first().click(); await p.waitForTimeout(1500); }
await p.waitForTimeout(3000); const inv = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.inventory.filter(i => /Щит|Кольцо/.test(i.name)).map(i => [i.name, i.id.slice(0, 12), !!i.serverOwned]), key); console.log('ui bag:', (await p.locator('main').innerText()).match(/(Щит|Кольцо)[^\n]*/g));
console.log('merged:', JSON.stringify(inv), 'server items left', s.world.tables.owned_items.length);
await s.close();
