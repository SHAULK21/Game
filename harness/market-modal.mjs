import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 10, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'm1', templateId: 'mat_wolf', name: 'Волчья шкура', type: 'material', rarity: 'common', level: 2, upgradeLevel: 0, icon: '🐺', stats: {}, sellPrice: 5, disassembleYield: {}, stackCount: 15});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.owned_items = [{id: 'a1b2c3d4-0000-4000-8000-0000000000aa', owner_telegram_id: 437290420, item_json: {templateId: 'arena_token', name: 'Жетон чемпиона Арены', type: 'material', rarity: 'epic', level: 2, upgradeLevel: 0, stats: {}, icon: '💠', sellPrice: 50, disassembleYield: {}}, quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, origin: 'game_command', created_at: new Date().toISOString()}]; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button').last().click(); await p.waitForTimeout(700); await p.getByRole('button', {name: /^Рынок/}).first().click(); await p.waitForTimeout(1500);
await p.getByRole('button', {name: /Продать вещь|Выставить/}).first().click(); await p.waitForTimeout(800);
console.log('after sell click btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).filter(x => x.length < 50).slice(-12).join(' / ')); await p.locator('button', {hasText: 'Выберите предмет'}).first().click(); await p.waitForTimeout(800);
await p.screenshot({path: `mm-${style}.png`});
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); return cs.position === 'fixed' && e.getBoundingClientRect().height > 300; }).map(e => ({cls: String(e.className).slice(0, 90), z: getComputedStyle(e).zIndex, txt: e.innerText.slice(0, 30).replace(/\n/g, ' '), parent: e.parentElement.tagName + '.' + String(e.parentElement.className).slice(0, 30)}))), null, 1));
await s.close();
