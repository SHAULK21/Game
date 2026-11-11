import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, gold: 50000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'axe1', templateId: 'axe_double', name: 'Секира теста', type: 'weapon', rarity: 'epic', level: 28, upgradeLevel: 0, stats: {attack: 100, critChance: 5}, icon: '🪓', sellPrice: 60, disassembleYield: {}, stackCount: 1});
save.player.inventory.push({id: 'sh1', templateId: 'shield_x', name: 'Щит теста', type: 'offhand', rarity: 'rare', level: 25, upgradeLevel: 0, stats: {defense: 40}, icon: '🛡️', sellPrice: 30, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; p.setDefaultTimeout(6000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(7000);
for (let k = 0; k < 3; k++) { for (const tx of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: tx}).count()) await p.getByRole('button', {name: tx}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('.ae-x').first().click().catch(() => {});
const H = () => p.evaluate(() => { const pl = window.__aethBridge.player; const f = i => i ? `${i.name}${i.twoHanded ? '[2H]' : ''} atk${i.stats?.attack ?? '-'}` : '—'; return `W: ${f(pl.equipped.weapon)} | O: ${f(pl.equipped.offhand)} | gold ${pl.gold} | atk ${window.__aethBridge.stats?.attack}`; });
console.log('start', await H());
// equip shield first
const eq = id => p.evaluate(id => window.__aethBridge.equipItem(window.__aethBridge.player.inventory.find(i => i.id === id)), id);
await eq('sh1'); await p.waitForTimeout(1500); console.log('shield on', await H());
// open bag, open axe dialog, reforge
await p.locator('nav.game-nav button, nav.game-nav a').nth(style === 'modern' ? 4 : 4).click().catch(() => {}); await p.waitForTimeout(500);
await p.evaluate(() => { const n = [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(b => /Сумка/.test(b.textContent)); n?.click(); }); await p.waitForTimeout(1500);
await p.locator('[data-inventory-item="axe1"]').first().click({force: true}); await p.waitForTimeout(1500);
const btn = p.locator('[data-ae-2h]'); console.log('dialog addon:', await btn.count() ? (await btn.first().innerText()).replace(/\n/g, ' ') : 'NONE');
await p.screenshot({path: `twohand-${style}-dialog.png`});
await btn.first().click({force: true}); await p.waitForTimeout(1500);
console.log('after reforge:', await p.evaluate(() => JSON.stringify(window.__aethBridge.player.inventory.find(i => i.id === 'axe1')?.stats)), await H());
console.log('dialog addon now:', await p.locator('[data-ae-2h]').count() ? (await p.locator('[data-ae-2h]').first().innerText()).replace(/\n/g, ' ') : 'NONE');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await eq('axe1'); await p.waitForTimeout(2500); console.log('axe on', await H());
console.log('toast:', await p.locator('.ae-toast').last().innerText().catch(() => ''));
console.log('tile 2H:', await p.locator('.ae-2h-tile').count());
await eq('sh1'); await p.waitForTimeout(2500); console.log('shield on again', await H());
await eq('axe1'); await p.waitForTimeout(2500); console.log('axe again', await H());
await p.evaluate(() => { const n = [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(b => /Герой/.test(b.textContent)); n?.click(); }); await p.waitForTimeout(1500);
console.log('offhand locked:', await p.locator('.ae-2h-locked').count());
await p.screenshot({path: `twohand-${style}-hero.png`});
// drop roll: add 40 new weapons
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, inventory: [...x.inventory, ...Array.from({length: 40}, (_, k) => ({id: 'drop_' + k + '_' + Date.now(), templateId: 'sword_x', name: 'Меч находка ' + k, type: 'weapon', rarity: 'rare', level: 20, upgradeLevel: 0, stats: {attack: 50}, icon: '⚔️', sellPrice: 10, disassembleYield: {}, stackCount: 1}))]})));
await p.waitForTimeout(2500);
console.log('2H from 40 drops:', await p.evaluate(() => window.__aethBridge.player.inventory.filter(i => /находка/.test(i.name) && i.twoHanded).map(i => i.stats.attack).join(',')));
await p.evaluate(() => { const n = [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(b => /Сумка/.test(b.textContent)); n?.click(); }); await p.waitForTimeout(2000);
console.log('bag 2H tiles:', await p.locator('.ae-2h-tile').count()); await p.locator('.ae-2h-tile').first().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({path: `twohand-${style}-bag.png`});
await p.locator('.ae-2h-tile').first().click({force: true}); await p.waitForTimeout(1200); await p.screenshot({path: `twohand-${style}-dialog2.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
