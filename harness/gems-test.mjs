import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.gold = 5000; save.player.silver = 5000; save.player.attributes = {...save.player.attributes, strength: 40, luck: 30}; save.player.statPoints = 3; save.player.inventory.push({id: 'mat-fang', templateId: 'mf', name: 'Острый клык', type: 'material', rarity: 'uncommon', level: 1, upgradeLevel: 0, icon: '🦷', stats: {}, sellPrice: 1, disassembleYield: {}, stackCount: 10}, {id: 'mat-ess', templateId: 'me', name: 'Магическая эссенция', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✨', stats: {}, sellPrice: 1, disassembleYield: {}, stackCount: 5}); save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
await p.waitForTimeout(5000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
const PL = () => p.evaluate(() => window.__aethBridge.player);
// craft vampirism crystal
await p.evaluate(() => window.__aethOpen.gems('craft')); await p.waitForTimeout(600);
await p.locator('.ae-gem-row', {hasText: 'Кристалл вампиризма'}).locator('button').click({force: true}); await p.waitForTimeout(400);
// buy flame crystal
await p.evaluate(() => [...document.querySelectorAll('.ae-tab')].find(b => /Купить/.test(b.textContent)).click()); await p.waitForTimeout(300);
await p.locator('.ae-gem-row', {hasText: 'Кристалл пламени'}).locator('button').click({force: true}); await p.waitForTimeout(400);
let pl = await PL(); console.log('panel:', (await p.locator('.ae-panel').innerText()).replace(/\n/g, ' | ').slice(0, 300)); console.log('gems in bag:', pl.inventory.filter(i => /ae_gem/.test(i.templateId)).map(i => i.name + '×' + (i.stackCount || 1)).join(', '), '| silver', pl.silver, 'gold', pl.gold);
// apply to equipped weapon
await p.evaluate(() => [...document.querySelectorAll('.ae-tab')].find(b => /Вставить/.test(b.textContent)).click()); await p.waitForTimeout(300);
await p.locator('.ae-gem-chip', {hasText: 'Вампиризм'}).click({force: true}); await p.waitForTimeout(300);
await p.locator('.ae-equip-row', {hasText: '(надето)'}).first().click({force: true}); await p.waitForTimeout(500);
await p.locator('.ae-gem-chip', {hasText: 'поджога'}).click({force: true}); await p.waitForTimeout(300);
await p.locator('.ae-equip-row', {hasText: '(надето)'}).first().click({force: true}); await p.waitForTimeout(600);
pl = await PL(); console.log('weapon:', JSON.stringify({name: pl.equipped.weapon.name, stats: pl.equipped.weapon.stats, gems: pl.equipped.weapon.gems}));
console.log('combat vampirism:', await p.evaluate(() => window.__aethBridge.stats.vampirism));
await p.screenshot({path: `gems-${style}.png`});
await p.locator('.ae-x').click().catch(() => {});
// respec
console.log('before respec:', JSON.stringify((await PL()).attributes), (await PL()).statPoints);
await p.evaluate(() => window.__aethOpen.profile()); await p.waitForTimeout(1500);
console.log('profile luck:', await p.locator('.ae-pill', {hasText: 'Удача'}).innerText().catch(() => 'none'));
await p.locator('.ae-panel button', {hasText: 'Сбросить'}).click({force: true}); await p.waitForTimeout(600);
pl = await PL(); console.log('after respec:', JSON.stringify(pl.attributes), pl.statPoints, 'silver', pl.silver);
// legendary generator sample
console.log('legendary sample:', JSON.stringify(await p.evaluate(() => window.__aethOpen.legend())).slice(0, 300));
console.log(s.log.filter(l => /pageerror|ae legendary/.test(l)).slice(0, 3).join('\n'));
await s.close();
