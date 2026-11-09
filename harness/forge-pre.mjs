import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Боевой меч следопыта леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
await p.waitForTimeout(5000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.locator('nav button, nav a').filter({hasText: 'Сумка'}).first().click({force: true}); await p.waitForTimeout(1200);
const tile = p.locator('main [aria-label*="Боевой меч следопыта"], main [title*="Боевой меч следопыта"], main button:has(img[alt*="Боевой меч следопыта"])').first(); console.log('tile found:', await tile.count()); if (!(await tile.count())) console.log('labels:', JSON.stringify((await p.evaluate(() => [...document.querySelectorAll('main button')].map(b => b.getAttribute('aria-label') || b.title || b.innerText).slice(0, 40)))));
await tile.click({force: true}); await p.waitForTimeout(800);
const btns = await p.locator('button').allInnerTexts(); console.log('dialog buttons:', JSON.stringify(btns.filter(t => /кузн|заточ|улучш/i.test(t))));
await p.locator('button').filter({hasText: /кузн|Заточ|Улучш/i}).first().click({force: true}); await p.waitForTimeout(1500);
const main = (await p.locator('main').innerText()).replace(/\n/g, ' | ');
console.log('forge:', main.slice(0, 600));
const up = p.locator('main button').filter({hasText: /Заточить до/}).first(); console.log('req:', (await p.locator('main').innerText()).replace(/\n/g, ' | ').slice(250, 900)); console.log('upgrade btn:', await up.innerText().catch(() => '-'), 'disabled', await up.isDisabled().catch(() => '-'));
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, gold: 99999, silver: 99999, inventory: [...x.inventory, ...['Серебряная руда','Нить древнего паука'].map((n, i) => ({id: 'mat' + i, templateId: 'mt' + i, name: n, type: 'material', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🪨', stats: {}, sellPrice: 1, disassembleYield: {}, stackCount: 50}))]}))); await p.waitForTimeout(600);
console.log('disabled now', await up.isDisabled().catch(() => '-')); if (!(await up.isDisabled().catch(() => true))) { await up.click(); await p.waitForTimeout(1500); console.log('banner:', await p.locator('.ae-banner, .ae-big-banner, [class*=banner]').allInnerTexts().catch(() => [])); }
await p.waitForTimeout(800); console.log('forge after:', (await p.locator('main').innerText()).replace(/\n/g, ' | ').slice(250, 420)); await p.screenshot({path: `forge-after-${style}.png`});
await p.locator('nav button, nav a').filter({hasText: 'Сумка'}).first().click({force: true}); await p.waitForTimeout(1200);
console.log('bag tile:', await p.evaluate(() => { const it = window.__aethBridge.player.inventory.find(i => /следопыта/.test(i.name)); const t = document.querySelector(`[data-inventory-item="${it?.id}"]`); return JSON.stringify({lvl: it?.upgradeLevel, tile: t ? t.innerText.replace(/\n/g, ' ') : 'no tile', badge: t?.querySelector('.ae-badges')?.innerText}); }));
await p.screenshot({path: `forge-pre-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
