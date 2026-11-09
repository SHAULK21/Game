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
await p.screenshot({path: `menu-${style}.png`}); await p.mouse.wheel(0, 600); await p.waitForTimeout(500); await p.screenshot({path: `menu2-${style}.png`}); await p.mouse.wheel(0, 700); await p.waitForTimeout(500); await p.screenshot({path: `menu3-${style}.png`});
console.log(await p.evaluate(() => { const h = [...document.querySelectorAll('*')].find(e => !e.childElementCount && e.textContent.trim() === 'Сражения'); if (!h) return 'no'; let c = h; for (let i = 0; i < 3; i++) c = c.parentElement; return c.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 1800); }));
console.log('DBG', await p.evaluate(() => [...document.querySelectorAll('.mechanics-menu-scroll > .mechanics-utilities > button')].map(b => JSON.stringify(b.textContent) + ':' + b.className).join(' | '))); console.log('GROUPS:', await p.evaluate(() => [...document.querySelectorAll('.mechanics-favorites, .mechanics-group, [data-ae-entry]')].map(g => (g.querySelector('h2,h3')?.textContent || '?') + ' => ' + [...g.querySelectorAll('.mechanics-entry-label, button > span:last-child, .ae-entry-btn b')].map(x => x.textContent.trim()).filter(Boolean).join(', ')).join('\n'))); console.log('NAV:', (await p.locator('nav').last().innerText()).replace(/\n/g, ', '));
await s.close();
