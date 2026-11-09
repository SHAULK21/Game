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
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1200);
const tabs = await p.evaluate(() => [...document.querySelectorAll('main button, main [role=tab]')].filter(b => /Подземелья|Пещеры/.test(b.textContent)).map(b => b.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 160)));
console.log('TABS', tabs.join('\n'));
await p.locator('main button', {hasText: /^Подземелья$|^Пещеры$/}).first().click({force: true}).catch(e => console.log('click fail'));
await p.waitForTimeout(1200);
console.log('after: section', await p.evaluate(() => document.querySelector('[data-world-section]')?.getAttribute('data-world-section')), 'fields btn visible', await p.getByRole('button', {name: /Отправиться на поля/}).isVisible().catch(() => false));
await p.screenshot({path: `lp-dungeons-${style}.png`});
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1200);
await p.screenshot({path: `lp-bag-${style}.png`}); console.log('TILE', await p.evaluate(() => document.querySelector('[data-inventory-item]')?.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 900)));
await p.locator('nav button').first().click(); await p.waitForTimeout(1000);
await p.screenshot({path: `lp-settle-${style}.png`}); await p.mouse.wheel(0, 500); await p.waitForTimeout(400); await p.screenshot({path: `lp-settle2-${style}.png`}); console.log('PLACE', await p.evaluate(() => { const b = document.querySelector('[data-settlement-place]'); return b ? b.parentElement.parentElement.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 700) : 'none'; }));
await s.close();
