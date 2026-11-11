import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, gold: 20000, silver: 100, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'gem_vamp_x', templateId: 'ae_gem_vamp', name: 'Кристалл вампиризма', type: 'material', rarity: 'epic', level: 1, upgradeLevel: 0, icon: '🩸', stats: {}, sellPrice: 50, disassembleYield: {}, stackCount: 8});
for (let k = 0; k < 6; k++) save.player.inventory.push({id: 'sw' + k, templateId: 'x', name: 'Клинок ' + k, type: 'weapon', rarity: 'legendary', level: 20, upgradeLevel: 0, stats: {attack: 60}, icon: '⚔️', sellPrice: 20, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern'; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; p.setDefaultTimeout(6000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
const gems = () => p.evaluate(() => window.__aethBridge.player.inventory.filter(i => i.templateId === 'ae_gem_vamp').reduce((n, i) => n + (i.stackCount || 1), 0));
const wallet = () => JSON.stringify(s.world.tables.ae_gem_wallet?.find(r => r.u === '437290420')?.g?.vamp);
await p.waitForTimeout(14000); for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
console.log('after first sync: bag', await gems(), 'server', wallet());
await p.evaluate(() => window.__aethOpen.gems?.('apply')); await p.waitForTimeout(400);
const open = async () => { await p.evaluate(() => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => /Сумка/.test(n.textContent))?.click()); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector('[data-ae-gems]')?.click()); await p.waitForTimeout(1200); };
await open();
for (let k = 0; k < 4; k++) {
  const chip = p.locator('.ae-panel .ae-gem-chip').first(); if (!(await chip.count())) { console.log('insert', k, ': no crystal chips —', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 120)); break; }
  await chip.click({force: true}); await p.waitForTimeout(400);
  await p.locator('.ae-panel .ae-equip-row:not([disabled])').last().click({force: true}); await p.waitForTimeout(1500);
  console.log('insert', k, ': bag', await gems(), 'server', wallet());
}
// cheat attempt: add 5 gems to the bag by hand
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, inventory: [...x.inventory, {id: 'cheat', templateId: 'ae_gem_vamp', name: 'Кристалл вампиризма', type: 'material', rarity: 'epic', level: 1, stats: {}, stackCount: 5}]})));
await p.locator('.ae-x').first().click().catch(() => {}); await p.waitForTimeout(300); await open();
console.log('after cheat + panel open: bag', await gems(), 'server', wallet(), '|', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 140));
// buy one in the shop
await p.locator('.ae-x').first().click().catch(() => {}); await p.evaluate(() => window.__aethOpen.gems?.('buy')); await p.waitForTimeout(800);
const hasBuy = await p.locator('.ae-panel .ae-gem-row button').count(); if (hasBuy) { await p.locator('.ae-panel .ae-gem-row button').first().click({force: true}); await p.waitForTimeout(1500); }
console.log('after buy: bag', await gems(), 'server', wallet(), 'gold', await p.evaluate(() => window.__aethBridge.player.gold), '(buy panel', hasBuy, ')');
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
