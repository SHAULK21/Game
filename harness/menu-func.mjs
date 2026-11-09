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
// tavern
await p.locator('nav button').last().click(); await p.waitForTimeout(1000);
const vis = n => p.locator('.mechanics-group .mechanics-entry:visible', {hasText: n}).count();
console.log('Шахта in group before', await vis('Шахта'), '| favorites', (await p.locator('.mechanics-favorites').innerText()).replace(/\n/g, ' '));
await p.locator('.mechanics-favorites button', {hasText: 'Шахта'}).locator('.ae-unpin').click(); await p.waitForTimeout(600);
console.log('after unpin: Шахта in group', await vis('Шахта'), '| favorites', (await p.locator('.mechanics-favorites').innerText().catch(() => '-')).replace(/\n/g, ' '));
await p.locator('[data-ae-group] button', {hasText: 'Дуэли'}).click(); await p.waitForTimeout(800); console.log('duel panel', await p.locator('.ae-panel h2').innerText()); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.locator('[data-ae-group] button', {hasText: 'Кооп и PvP'}).click(); await p.waitForTimeout(800); console.log('quests panel', await p.locator('.ae-panel h2').innerText());
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
