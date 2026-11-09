import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'weak-helm', templateId: 'h0', name: 'Дырявый шлем', type: 'helmet', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🪖', stats: {defense: 1}, sellPrice: 1, disassembleYield: {}, stackCount: 1}, {id: 'big-helm', templateId: 'h1', name: 'Шлем стража', type: 'helmet', rarity: 'rare', level: 20, upgradeLevel: 0, icon: '🪖', stats: {defense: 60, maxHp: 120}, sellPrice: 10, disassembleYield: {}, stackCount: 1}, {id: 'too-high', templateId: 'h2', name: 'Шлем титана', type: 'helmet', rarity: 'epic', level: 60, upgradeLevel: 0, icon: '🪖', stats: {defense: 500}, sellPrice: 10, disassembleYield: {}, stackCount: 1}); save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); const me0 = w.tables.players.find(p => p.telegram_id == 437290420); me0.level = 30;  }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
const eq = () => p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__aethBridge.player.equipped).map(([k, v]) => [k, v?.name]))));
const pw = () => p.evaluate(() => { const s = window.__aethBridge.stats; return `atk ${s.attack} def ${s.defense} hp ${s.maxHp}`; });
await p.waitForTimeout(1500); console.log('start:', await eq(), await pw());
await p.waitForTimeout(9000);
console.log('after:', await eq(), await pw());
console.log('toasts:', await p.locator('.ae-toast').allInnerTexts());
console.log(s.log.filter(l => /pageerror|ae autoequip/.test(l)).slice(0, 3).join('\n'));
await s.close();
