import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 3, gold: 20000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'big-one', templateId: 'x', name: 'Клинок сотого уровня', type: 'weapon', rarity: 'legendary', level: 100, upgradeLevel: 0, stats: {attack: 900}, icon: '⚔️', sellPrice: 60, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')));
  new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'}); Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, market_gold: 0});
  const me = w.tables.players.find(p => String(p.telegram_id) === '437290420'); if (me) me.level = 3; }});
const p = s.page; p.setDefaultTimeout(6000); await p.setViewportSize({width: 390, height: 844});
let answer = '800'; p.on('dialog', d => d.accept(d.type() === 'prompt' ? answer : undefined));
await p.waitForTimeout(6000);
for (let k = 0; k < 3; k++) { for (const tx of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: tx}).count()) await p.getByRole('button', {name: tx}).first().click().catch(() => {}); await p.waitForTimeout(250); }
for (let k = 0; k < 3; k++) { const b = p.locator('.ae-story button'); if (await b.count()) await b.first().click().catch(() => {}); await p.waitForTimeout(500); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const {handleProgressRequest} = await import('../tgcloud/lib/gameEngine.js');
const t2 = new Date().toISOString();
s.world.tables.owned_items.push({id: 'b1', owner_telegram_id: 555, item_json: {name: 'Доспех Бориса', type: 'armor', rarity: 'rare', level: 18, stats: {defense: 50}, sellPrice: 30}, quantity: 1, locked: false, equipped_slot: null, bound_clan_id: null, origin: 'game_command', created_at: t2, updated_at: t2});
const call = (path, body, method = 'POST') => handleSocialRequest(s.world, {path, method, body}, {id: 555}, Date.now()).then(r => r.body);
const chatLot = (await call('/api/ae-market/lot', {kind: 'chat', itemId: 'b1', price: null})).lot;
const enc = o => Buffer.from(unescape(encodeURIComponent(JSON.stringify(o))), 'binary').toString('base64');
const say = text => handleProgressRequest(s.world, {path: '/api/chat/global', method: 'POST', body: {text}}, {id: 555, username: 'b', displayName: 'Борис'}, {now: () => Date.now(), isAdmin: () => false});
await say(`💰 Продаю: Доспех Бориса — жду предложений ⟦ae:l:${enc({id: chatLot.id, p: null, n: 'Доспех Бориса', r: 'rare', l: 18, u: 0, t: 'armor', s: {defense: 50}})}⟧`);
await say(`Продаю: Шлем Бориса ⟦ae:i:${enc({n: 'Шлем Бориса', r: 'rare', l: 18, u: 0, t: 'helmet', s: {defense: 20}, w: '555', i: 'b-helm'})}⟧`);
const gold0 = (await P()).gold; console.log('hero gold start', gold0);
await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(5000);
const lotTxt = async () => (await p.locator('.ae-chat-lot').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ');
console.log('lot card:', await lotTxt());
await p.locator('.ae-chat-lot button', {hasText: 'Своя цена'}).first().click({force: true}); await p.waitForTimeout(4000);
console.log('after offer:', await lotTxt());
console.log('offer row:', JSON.stringify(s.world.tables.ae_lot_offers.map(o => [o.price, o.status])), '| hero gold', (await P()).gold);
// shown item: price request
answer = '600';
await p.locator('.ae-buy-shown').first().click({force: true}); await p.waitForTimeout(4000);
console.log('shown card:', (await p.locator('[data-ae-shown]').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
// leave chat and come back: the cards must remember
await p.reload(); await p.waitForTimeout(6000);
for (let k = 0; k < 3; k++) { for (const tx of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: tx}).count()) await p.getByRole('button', {name: tx}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(7000);
console.log('after reload lot:', await lotTxt());
console.log('after reload shown:', (await p.locator('[data-ae-shown]').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
console.log('requests:', JSON.stringify(s.world.tables.ae_buy_requests.map(r => [r.price, r.status])), '| hero gold', (await P()).gold);
// seller accepts the lot offer
const offer = s.world.tables.ae_lot_offers[0];
console.log('accept:', JSON.stringify(await call('/api/ae-market/lot/decide', {id: chatLot.id, offerId: offer.id, accept: true})));
console.log('seller wallet', s.world.tables.players.find(p => p.telegram_id == 555).market_gold);
for (let k = 0; k < 18; k++) { await p.waitForTimeout(2000); console.log('t', k*2, await p.evaluate(() => { const pl = window.__aethBridge.player; return [...pl.inventory, ...Object.values(pl.equipped||{})].filter(i => i && /Бориса/.test(i.name)).map(i => i.name + (i.serverOwned?'[S]':'[L]') + (i.isEquipped?'[E]':'')).join(',') + ' | inv ' + pl.inventory.length; })); }
const inv = (await P()).inventory.filter(i => /Бориса/.test(i.name)).map(i => i.name + (i.serverOwned ? '[S]' : '[bag]'));
console.log('last items:', await p.evaluate(() => JSON.stringify(window.__aethBridge.player.inventory.slice(-2))));
console.log('claims:', JSON.stringify((s.world.tables.ae_claims||[]).map(c => [c.u, c.items.map(i => i.item_json.name)])));
console.log('bridge bag:', await p.evaluate(() => window.__aethBridge.player.inventory.filter(i => /Бориса/.test(i.name)).map(i => i.name + ':' + i.id).join(', ')));
console.log('buyer bag:', inv.join(', '), '| hero gold', (await P()).gold, '(spent', gold0 - (await P()).gold, ')', '| server still owns:', s.world.tables.owned_items.filter(i => /Бориса/.test(i.item_json.name)).length);
// selling a lvl-100 item as a lvl-3 hero
answer = '5000';
const r = await p.evaluate(async () => { const b = window.__aethBridge; const it = b.player.inventory.find(i => i.id === 'big-one'); return !!it; });
const dep = await handleSocialRequest(s.world, {path: '/api/items/deposit', method: 'POST', body: {operationId: crypto.randomUUID(), item: {name: 'Клинок сотого уровня', type: 'weapon', rarity: 'legendary', level: 100, stats: {attack: 900}}}}, {id: 437290420}, Date.now());
console.log('lvl100 in bag', r, '| deposit as lvl3:', dep.status, JSON.stringify(dep.body).slice(0, 100));
const lot = await handleSocialRequest(s.world, {path: '/api/ae-market/lot', method: 'POST', body: {kind: 'chat', itemId: dep.body.itemId, price: 5000}}, {id: 437290420}, Date.now());
console.log('lvl100 lot:', lot.status, lot.body.error || 'ok');
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
