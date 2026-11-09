import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, gold: 2000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'bow1', templateId: 'bow', name: 'Лук следопыта', type: 'weapon', rarity: 'epic', level: 15, upgradeLevel: 4, stats: {attack: 55}, icon: '?', sellPrice: 10, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16}); w.tables.friendships = [{pair: '437290420:555', a: '437290420', b: '555', requester: '555', status: 'accepted', created_at: '', updated_at: ''}]; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const P = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return {gold: x.gold, items: x.inventory.filter(i => /Лук|Шлем/.test(i.name)).map(i => i.name)}; }, key);
console.log(style, 'start', JSON.stringify(await P()));
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await p.waitForTimeout(1200);
await p.locator('[data-inventory-item="bow1"]').click(); await p.waitForTimeout(1200);
console.log('sell-to-friend btn', await p.locator('[data-ae-sell-friend]').count());
await p.locator('[data-ae-sell-friend]').click(); await p.waitForTimeout(800);
await p.locator('.ae-panel input[type=number]').fill('700'); await p.locator('.ae-panel button', {hasText: 'Предложить сделку'}).click(); await p.waitForTimeout(900);
console.log('after offer', JSON.stringify(await P()), 'server offers', s.world.tables.trade_offers?.length);
const offer = s.world.tables.trade_offers[0];
await handleSocialRequest(s.world, {path: '/api/trade/accept', method: 'POST', body: {offerId: offer.id, gold: 5000}}, {id: 555}, Date.now());
await p.evaluate(() => window.__aethOpen.pulse()); await p.waitForTimeout(2500);
console.log('after Boris bought', JSON.stringify(await P()), 'popups', await p.locator('.ae-pop').allInnerTexts().then(a => a.map(x => x.replace(/\n/g, ' '))));
await p.evaluate(() => document.querySelectorAll('.ae-pop').forEach(e => e.remove()));
// Boris offers a helmet to admin
await handleSocialRequest(s.world, {path: '/api/trade/offer', method: 'POST', body: {buyerId: '437290420', price: 300, offerId: crypto.randomUUID(), item: {name: 'Шлем дозорного', rarity: 'rare', level: 12, upgradeLevel: 2, type: 'helmet', stats: {defense: 30}, stackCount: 1}}}, {id: 555}, Date.now());
await p.evaluate(() => window.__aethOpen.friends('trades')); await p.waitForTimeout(1200); await p.locator('.ae-panel').screenshot({path: `trade-tab-${style}.png`});
await p.locator('.ae-panel button', {hasText: /Купить/}).click(); await p.waitForTimeout(1000);
console.log('after buying helmet', JSON.stringify(await P()));
// decline flow returns item
const o2 = crypto.randomUUID(); await handleSocialRequest(s.world, {path: '/api/trade/offer', method: 'POST', body: {buyerId: '555', price: 50, offerId: o2, item: {name: 'Шлем старый', rarity: 'common', level: 2, type: 'helmet', stats: {defense: 3}, stackCount: 1}}}, {id: 437290420}, Date.now());
await handleSocialRequest(s.world, {path: '/api/trade/decline', method: 'POST', body: {offerId: o2}}, {id: 555}, Date.now());
await p.evaluate(() => window.__aethOpen.pulse()); await p.waitForTimeout(2500); console.log('after decline return', JSON.stringify(await P()));
await p.keyboard.press('Escape');
// quick bars
if (style === 'fantasy') await p.locator('nav button', {hasText: 'Арена'}).first().click(); else { await p.locator('nav button').last().click(); await p.waitForTimeout(500); await p.getByRole('button', {name: /^Арена/}).first().click(); }
await p.waitForTimeout(1500); console.log('arena quick bar', await p.locator('[data-ae-quick]').count()); await p.screenshot({path: `quick-arena-${style}.png`});
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1500); console.log('world quick bar', await p.locator('[data-ae-quick]').count()); await p.screenshot({path: `quick-world-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
