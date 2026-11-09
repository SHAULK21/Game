import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 16, silver: 50000, gold: 50000, worldPlace: 'settlement', royalBriefingStep: 99, regionProgress: {reg_plains: {}}}); delete pl.firstJourney; delete pl.firstJourneyDeparture;
const sword = {templateId: 'test_blade', name: 'Клинок теста', type: 'weapon', rarity: 'rare', level: 10, upgradeLevel: 2, stats: {attack: 40, critChance: 3}, icon: '🗡️', sellPrice: 100, disassembleYield: {silver: 5}, stackCount: 1};
pl.inventory.push({...sword, id: 'sw-a'}, {...sword, id: 'sw-b', upgradeLevel: 5});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const pool = new E.NativePool(w, () => Date.now()); pool.ensurePlayer({id: 5551, displayName: 'Борис'}); const b = w.tables.players.find(p => p.telegram_id == 5551); b.character_name = 'Борис'; b.level = 18; b.class_id = 'druid'; b.last_seen_at = new Date().toISOString(); w.tables.players.find(p => p.telegram_id == 437290420).level = 16; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4500);
for (let k = 0; k < 3; k++) { for (const t of ['В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); } for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
console.log('bridge', await p.evaluate(() => !!window.__aethBridge?.player));
await p.locator('nav button').last().click(); await p.waitForTimeout(1000);
const entry = p.locator('[data-ae-entry]'); console.log(style, 'menu block', await entry.count());
await entry.first().scrollIntoViewIfNeeded().catch(()=>{}); await p.screenshot({path: `ae-menu-${style}.png`});
// merge
await p.getByRole('button', {name: /Объединение/}).first().click(); await p.waitForTimeout(600);
await p.screenshot({path: `ae-merge-${style}.png`});
await p.getByRole('button', {name: /Объединить/}).first().click(); await p.waitForTimeout(800);
const inv = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.inventory.filter(i => i.templateId === 'test_blade').map(i => [i.name, i.upgradeLevel, JSON.stringify(i.stats)]), key);
console.log('after merge', JSON.stringify(inv), 'silver', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.silver, key));
await p.keyboard.press('Escape');
// friends
await p.evaluate(() => window.__aethOpen.friends('search')); await p.waitForTimeout(400);
await p.locator('.ae-input').fill('бор'); await p.locator('.ae-panel .ae-btn.ae-primary', {hasText: 'Найти'}).click(); await p.waitForTimeout(500);
await p.getByRole('button', {name: '+ В друзья'}).click(); await p.waitForTimeout(500);
console.log('friendship', JSON.stringify(s.world.tables.friendships));
s.world.tables.friendships[0].status = 'accepted';
await p.evaluate(() => window.__aethOpen.friends('friends')); await p.waitForTimeout(500);
await p.getByRole('button', {name: '💬'}).first().click(); await p.waitForTimeout(400);
await p.locator('.ae-input').fill('Привет, Борис!'); await p.getByRole('button', {name: '➤'}).click(); await p.waitForTimeout(600);
await p.screenshot({path: `ae-chat-${style}.png`}); console.log('dm stored', s.world.tables.private_chat_messages?.length);
await p.keyboard.press('Escape');
// coop
await p.evaluate(() => window.__aethOpen.coop()); await p.waitForTimeout(800);
await p.getByRole('button', {name: 'Открыть'}).nth(1).click(); await p.waitForTimeout(800);
const room = s.world.tables.coop_rooms[0];
const E = await import('../tgcloud/lib/social.js'); await E.handleSocialRequest(s.world, {path: '/api/coop/join', method: 'POST', body: {roomId: room.id}}, {id: 5551}, Date.now());
await p.waitForTimeout(1800); await p.getByRole('button', {name: /Начать поход/}).click(); await p.waitForTimeout(1200);
for (let i = 0; i < 4; i++) { await p.getByRole('button', {name: /Атака/}).first().click().catch(()=>{}); await p.waitForTimeout(1900); }
await p.screenshot({path: `ae-coop-${style}.png`}); console.log('coop stage', s.world.tables.coop_rooms[0].stage, 'foe hp', s.world.tables.coop_rooms[0].foe?.hp);
await p.keyboard.press('Escape');
// wiki
await p.evaluate(() => window.__aethOpen.wiki()); await p.waitForTimeout(400); await p.locator('.ae-wiki summary').nth(5).click(); await p.screenshot({path: `ae-wiki-${style}.png`}); await p.keyboard.press('Escape');
// story: move into woods
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, worldPlace: 'field', currentRegionId: 'reg_whisper_woods'}))); await p.waitForTimeout(2600);
console.log('story overlay', await p.locator('.ae-story').count()); await p.screenshot({path: `ae-story-${style}.png`});
console.log(s.log.filter(l => /error|warn/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).join('\n'));
await s.close();
