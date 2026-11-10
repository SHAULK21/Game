import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, gold: 20000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
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
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const t2 = new Date().toISOString(), mk = (id, name, lvl) => ({id, owner_telegram_id: 555, item_json: {name, type: 'armor', rarity: 'rare', level: lvl, stats: {defense: 50}, sellPrice: 30}, quantity: 1, locked: false, equipped_slot: null, bound_clan_id: null, origin: 'game_command', created_at: t2, updated_at: t2});
s.world.tables.owned_items.push(mk('b1', 'Доспех Бориса', 18), mk('b2', 'Шлем Бориса', 18));
const call = (path, body) => handleSocialRequest(s.world, {path, method: 'POST', body}, {id: 555}, Date.now()).then(r => r.body);
const enc = o => Buffer.from(unescape(encodeURIComponent(JSON.stringify(o))), 'binary').toString('base64');
const {handleProgressRequest} = await import('../tgcloud/lib/gameEngine.js');
// an old-style shown item from Boris (no seller id inside the token)
await handleProgressRequest(s.world, {path: '/api/chat/global', method: 'POST', body: {text: `Продаю: Доспех Бориса ⟦ae:i:${enc({n: 'Доспех Бориса', r: 'rare', l: 18, u: 0, t: 'armor', s: {defense: 50}})}⟧`}}, {id: 555, username: 'b', displayName: 'Борис'}, {now: () => Date.now(), isAdmin: () => false});
await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(5000);
console.log('card:', (await p.locator('.ae-chat-item').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
await p.locator('.ae-buy-shown').first().click({force: true}); await p.waitForTimeout(5000);
const R = s.world.tables.ae_buy_requests?.[0]; console.log('request:', R?.status, R?.price, 'seller', R?.seller, '| hero gold', (await P()).gold, '| card now:', (await p.locator('.ae-chat-item').first().innerText()).replace(/\n+/g, ' | ').slice(-40));
const r2 = await call('/api/ae-market/request/decide', {id: R.id, accept: true, itemId: 'b1'}); console.log('boris sells:', JSON.stringify(r2));
await p.waitForTimeout(3000); console.log('admin got armor:', s.world.tables.owned_items.some(i => String(i.owner_telegram_id) === '437290420' && i.item_json.name === 'Доспех Бориса'));
// the other way: admin shows own item, Boris asks to buy, admin sells from «Запросы»
await p.evaluate(() => window.__aethOpen.shareItem(window.__aethBridge.player.inventory.find(i => i.id === 'sell-me'))); await p.waitForTimeout(800);
await p.locator('.ae-panel button', {hasText: 'Просто показать'}).click(); await p.waitForTimeout(2500);
const tok = s.world.tables.global_chat_messages?.slice(-1)[0]?.text || s.world.tables.chat_messages?.slice(-1)[0]?.text || '';
const o = JSON.parse(decodeURIComponent(escape(Buffer.from(tok.match(/⟦ae:i:([^⟧]+)⟧/)[1], 'base64').toString('binary')))); console.log('shared token has seller+id:', o.w, o.i);
await call('/api/ae-market/deposit', {gold: 3000, operationId: crypto.randomUUID()});
console.log('boris asks:', JSON.stringify(await call('/api/ae-market/request', {seller: o.w, price: 2500, item: o})));
await p.waitForTimeout(1000); await p.evaluate(() => window.__aethOpen.auction('req')); await p.waitForTimeout(2000);
console.log('requests tab:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').slice(0, 330));
await p.locator('.ae-panel button', {hasText: 'Продать'}).first().click({force: true}); await p.waitForTimeout(5000);
console.log('sold:', s.world.tables.ae_buy_requests.slice(-1)[0].status, '| boris got blade:', s.world.tables.owned_items.some(i => String(i.owner_telegram_id) === '555' && i.item_json.level === 25), '| blade in admin bag:', (await P()).inventory.some(i => i.level === 25 && i.type === 'weapon'), '| hero gold', (await P()).gold);
await p.screenshot({path: `shown-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
