import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 29, gold: 13000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'sell-me', templateId: 'x', name: 'Клинок на продажу', type: 'weapon', rarity: 'epic', level: 25, upgradeLevel: 0, stats: {attack: 120}, icon: '⚔️', sellPrice: 60, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const lid = crypto.randomUUID(), t = new Date().toISOString();
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')));
  new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'}); Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, market_gold: 9000});
  (w.tables.market_listings ||= []).push({id: lid, seller_telegram_id: 555, item_json: {name: 'Посох друида', type: 'weapon', rarity: 'legendary', level: 20, stats: {magicAttack: 14}, sellPrice: 50}, quantity: 1, price_gold: 10000, verified: true, status: 'active', created_at: t, expires_at: new Date(Date.now() + 5 * 864e5).toISOString(), seller_reset_version: 0}); }});
const p = s.page; p.setDefaultTimeout(6000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept(d.type() === 'prompt' ? '2500' : undefined));
await p.waitForTimeout(6000);
for (let k = 0; k < 3; k++) { for (const tx of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: tx}).count()) await p.getByRole('button', {name: tx}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
for (let k = 0; k < 3; k++) { const b = p.locator('.ae-story button'); if (await b.count()) await b.first().click().catch(() => {}); await p.waitForTimeout(500); }
// 1) market purchase with an empty wallet
await p.evaluate(() => document.querySelector('[data-settlement-place="market"]').click()); await p.waitForTimeout(3000);
console.log('tools:', await p.locator('[data-ae-market-tools] button').allInnerTexts());
console.log('market texts:', await p.evaluate(() => [...document.querySelectorAll('main p, main span, main small')].filter(e => e.offsetParent && /кошел|золотом героя/i.test(e.textContent)).map(e => e.textContent.trim().slice(0, 70)).join(' || ')));
const g0 = (await P()).gold; await p.locator('main button', {hasText: /^Купить$/}).first().click({force: true}); await p.waitForTimeout(6000);
console.log('panel opened?', await p.locator('.ae-panel').count());
const L = s.world.tables.market_listings.find(l => l.id === lid);
console.log('bought:', L.status, '| hero gold', g0, '→', (await P()).gold, '| wallet', s.world.tables.players.find(x => x.telegram_id == 437290420).market_gold, '| has staff:', (await P()).inventory.some(i => i.type === 'weapon' && i.rarity === 'legendary' && i.level === 20));
// 2) sell through the chat
await p.evaluate(() => window.__aethOpen.shareItem(window.__aethBridge.player.inventory.find(i => i.id === 'sell-me'))); await p.waitForTimeout(800);
await p.locator('.ae-panel input').fill('3000'); await p.locator('.ae-panel button', {hasText: 'Выставить на продажу'}).click(); await p.waitForTimeout(3000);
const lot = s.world.tables.ae_lots?.[0]; console.log('chat lot:', lot?.status, lot?.price, lot?.item_json?.name, '| in bag:', (await P()).inventory.some(i => i.name === 'Клинок на продажу'));
await p.evaluate(() => document.querySelector('nav button')?.click()); await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(4000);
console.log('chat card:', (await p.locator('.ae-chat-lot').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const r = await handleSocialRequest(s.world, {path: '/api/ae-market/lot/offer', method: 'POST', body: {id: lot.id, price: 2500}}, {id: 555}, Date.now()); console.log('boris offers:', JSON.stringify(r.body));
await p.waitForTimeout(36000); console.log('chat card after offer:', (await p.locator('.ae-chat-lot').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
await p.evaluate(() => window.__aethOpen.auction('mine')); await p.waitForTimeout(1500);
console.log('my lots:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
await p.locator('.ae-panel .ae-lot-offers button', {hasText: 'Принять'}).first().click(); await p.waitForTimeout(2000);
await p.waitForTimeout(4000); console.log('seller income → hero gold:', (await P()).gold, '| wallet', s.world.tables.players.find(x => x.telegram_id == 437290420).market_gold);
console.log('accepted:', s.world.tables.ae_lots[0].status, s.world.tables.ae_lots[0].soldPrice, '| boris got item:', s.world.tables.owned_items.some(i => String(i.owner_telegram_id) === '555' && i.item_json.level === 25 && i.item_json.type === 'weapon'));
// 3) auction tab
await p.locator('.ae-tab', {hasText: 'Выставить'}).click({force: true}); await p.waitForTimeout(700);
console.log('sell tab:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 200));
await p.screenshot({path: `market-auction-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
