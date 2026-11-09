import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
await p.waitForTimeout(5000);
for (const r of ['uncommon', 'rare', 'epic', 'legendary']) { const g = await p.evaluate(r => window.__aethOpen.gear(r), r); console.log(r.padEnd(9), g.name.padEnd(30), 'ур', g.level, JSON.stringify(g.stats), '|', g.description); }
// simulate 200 kills + 3 bosses
const before = await p.evaluate(() => window.__aethBridge.player.inventory.length);
for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, maxInventorySlots: 400, statsSummary: {...x.statsSummary, monstersKilled: (x.statsSummary.monstersKilled || 0) + 5}}))); await p.waitForTimeout(1100); }
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, statsSummary: {...x.statsSummary, bossesDefeated: (x.statsSummary.bossesDefeated || 0) + 3, monstersKilled: (x.statsSummary.monstersKilled || 0) + 3}}))); await p.waitForTimeout(1500);
const got = await p.evaluate(() => window.__aethBridge.player.inventory.filter(i => /^loot_/.test(i.id)).map(i => i.rarity));
const c = {}; for (const r of got) c[r] = (c[r] || 0) + 1; console.log('after 200 kills + 3 bosses:', JSON.stringify(c));
console.log(s.log.filter(l => /pageerror|ae legendary/.test(l)).slice(0, 3).join('\n'));
await s.close();
