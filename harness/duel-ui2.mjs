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
await p.evaluate(() => window.__aethOpen.duel()); await p.waitForTimeout(700);
await p.locator('.ae-panel input').fill('Борис'); await p.locator('.ae-panel button', {hasText: 'Бросить вызов'}).click(); await p.waitForTimeout(1000);
const openMenu = async () => { if (!(await p.locator('[data-ae-skill-menu]').count())) { await p.locator('.ae-bv button').filter({hasText: /^Навыки$/}).first().click({force: true}); await p.waitForTimeout(300); } };
await openMenu(); console.log('skills:', (await p.locator('[data-ae-skill-menu] [data-combat-skill] strong, [data-ae-skill-menu] [data-combat-skill] .text-xs span:nth-child(2)').allInnerTexts()).join(', '));
await p.locator('[data-ae-skill-menu] [data-combat-skill]:not([disabled])').first().click({force: true}); await p.waitForTimeout(800);
await p.screenshot({path: `duel2-${style}.png`, fullPage: true});
for (let i = 0; i < 40 && await p.locator('.ae-bv').count(); i++) { await openMenu().catch(() => {}); const k = p.locator('[data-ae-skill-menu] [data-combat-skill]:not([disabled])'); if (await k.count()) await k.last().click({force: true}).catch(() => {}); else await p.locator('.ae-bv button').filter({hasText: /^Атака$/}).first().click({force: true}).catch(() => {}); await p.waitForTimeout(250); }
console.log('result:', (await p.locator('.ae-result').innerText().catch(() => 'none')).replace(/\n/g, ' | '));
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
