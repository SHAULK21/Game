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
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, currentRegionId: 'reg_plains'})));
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1000);
const land = p.locator('main [role=button], main button').filter({hasText: /Зеленые равнины|Зелёные равнины/}).first(); await land.click().catch(() => {}); await p.waitForTimeout(600);
await p.getByRole('button', {name: /^Отправиться/}).last().click().catch(() => {}); await p.waitForTimeout(4500);
await p.getByRole('button', {name: /Начать охоту|НАЧАТЬ ОХОТУ/i}).first().click().catch(() => {}); await p.waitForTimeout(1500); if (!(await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')))) { await p.getByRole('button', {name: /Атаковать/}).first().click().catch(() => {}); await p.waitForTimeout(2500); }
await p.screenshot({path: `native-combat-${style}.png`, fullPage: true});
const html = await p.evaluate(() => { const m = document.querySelector('main'); const clone = m.cloneNode(true); clone.querySelectorAll('svg').forEach(s => s.replaceWith(document.createTextNode('[svg]'))); return clone.outerHTML; });
fs.writeFileSync(`native-combat-${style}.html`, html); console.log(style, 'len', html.length, 'in-combat', await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')));
await s.close();
