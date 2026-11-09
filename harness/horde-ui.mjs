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
const PS = () => p.evaluate(() => { const x = window.__aethBridge.player; return {gold: x.gold, energy: x.energy, level: x.level, exp: x.exp}; });
console.log('before', JSON.stringify(await PS()));
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(900);
await p.locator('.ae-panel').screenshot({path: `horde-lobby-${style}.png`});
await p.locator('.ae-horde-go', {hasText: 'В Орду'}).click(); await p.waitForTimeout(700);
for (let i = 0; i < 6; i++) { await p.locator('.ae-bv .combat-action-attack, .ae-bv button:has-text("Атака")').first().click({force: true}); await p.waitForTimeout(250); }
await p.locator('.ae-panel').screenshot({path: `horde-fight-${style}.png`});
const t0 = Date.now(); await p.locator('.ae-bv button', {hasText: 'Автобой'}).first().click({force: true});
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); if (await p.locator('.ae-result').count()) break; if (i === 6) await p.locator('.ae-panel').screenshot({path: `horde-auto-${style}.png`}); }
console.log('auto run seconds', ((Date.now() - t0) / 1000).toFixed(1), '| result', (await p.locator('.ae-result').innerText().catch(() => 'none')).replace(/\n/g, ' | '));
await p.locator('.ae-panel button', {hasText: 'Забрать добычу'}).click().catch(e => console.log('noclaim')); await p.waitForTimeout(900);
console.log('after', JSON.stringify(await PS()));
// blood moon visuals
await p.locator('.ae-horde-go', {hasText: 'Кровавая луна'}).click(); await p.waitForTimeout(700);
for (let i = 0; i < 5; i++) { await p.locator('.ae-bv .combat-action-attack, .ae-bv button:has-text("Атака")').first().click({force: true}); await p.waitForTimeout(250); }
await p.locator('.ae-panel').screenshot({path: `horde-blood-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
