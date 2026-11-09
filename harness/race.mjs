import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 10, silver: 20000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const ring = {templateId: 'drop_кольцо_эхолокации', name: 'Кольцо эхолокации', type: 'ring', rarity: 'rare', level: 4, upgradeLevel: 0, stats: {critChance: 4, maxHp: 30}, icon: '💍', sellPrice: 60, disassembleYield: {silver: 8}};
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.owned_items = ['a1b2c3d4-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000002'].map(id => ({id, owner_telegram_id: 437290420, item_json: ring, quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, origin: 'game_command', created_at: new Date().toISOString()})); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(8000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(9000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(300);
await p.locator('[data-ae-bag-merge]').click(); await p.waitForTimeout(300);
await p.getByRole('button', {name: /Объединить ·/}).first().click();
await p.waitForTimeout(9000);
console.log('toast:', await p.locator('.ae-toast').innerText().catch(() => ''), '| rings before stale:', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.inventory.filter(i => /Кольцо/.test(i.name)).map(i => i.name + '|' + i.id.slice(0, 12)), key), '| silver', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.silver, key));
console.log('calls:', s.calls.filter(c => /items/.test(c.path)).map(c => c.path.slice(0, 40) + ' ' + c.status).join(', '));
// simulate a stale sync bringing an original back
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, inventory: [...x.inventory, {id: 'a1b2c3d4-0000-4000-8000-000000000002', templateId: 'drop_кольцо_эхолокации', name: 'Кольцо новобранца', type: 'ring', rarity: 'rare', level: 4, upgradeLevel: 0, stats: {critChance: 4}, icon: '💍', stackCount: 1, serverOwned: true}]})));
await p.waitForTimeout(1500);
const rings = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.inventory.filter(i => /Кольцо/.test(i.name)).map(i => `${i.name}|${i.id.slice(0, 14)}|server:${!!i.serverOwned}`), key);
console.log('rings in bag after merge:', rings, 'server rows', s.world.tables.owned_items.length);
await s.close();
