import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, silver: 1000, gold: 1000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'sh1', templateId: 'sh', name: 'Лук следопыта ★2', ascension: 2, type: 'weapon', rarity: 'epic', level: 15, upgradeLevel: 4, stats: {attack: 55, critChance: 5}, icon: '?', sellPrice: 10, disassembleYield: {}, stackCount: 1});
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const now = Date.now();
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const pool = new E.NativePool(w, () => now); pool.ensurePlayer({id: 555, displayName: 'Борис'});
  const b = w.tables.players.find(p => p.telegram_id == 555); Object.assign(b, {character_name: 'Борис', level: 16, class_id: 'berserker', last_seen_at: new Date().toISOString()}); w.tables.players.find(p => p.telegram_id == 437290420).level = 18;
  w.tables.friendships = [{pair: '437290420:555', a: '437290420', b: '555', requester: '555', status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString()}];
  w.tables.private_chat_messages = [{id: 1, sender_id: '555', recipient_id: '437290420', client_message_id: 'x', text: 'Привет! Продашь лук?', created_at: new Date().toISOString(), read_at: null}];
  w.tables.global_chat_messages = [{id: 1, telegram_id: 555, text: 'Кто в кооп?', created_at: new Date().toISOString()}]; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.waitForTimeout(3500);
console.log(style, 'toasts:', await p.locator('.ae-pop').allInnerTexts().then(a => a.map(x => x.replace(/\n/g, ' '))));
await p.screenshot({path: `b5-toast-${style}.png`});
// duel via PvP tab
await p.evaluate(() => document.querySelectorAll('.ae-pop').forEach(e => e.remove()));
if (style === 'fantasy') { await p.locator('nav button', {hasText: 'Арена'}).first().click(); } else { await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.getByRole('button', {name: /^Арена/}).first().click(); } await p.waitForTimeout(1000);
await p.getByRole('button', {name: /PvP/}).first().click().catch(() => {}); await p.waitForTimeout(1000);
console.log('pvp duel card', await p.locator('[data-ae-duel]').count());
await (await p.locator('[data-ae-duel]').count() ? p.locator('[data-ae-duel]').click() : p.evaluate(() => window.__aethOpen.duel())); await p.waitForTimeout(800);
await p.locator('.ae-panel .ae-input').fill('Борис'); await p.locator('.ae-panel button', {hasText: 'Бросить вызов'}).click(); await p.waitForTimeout(800);
for (let i = 0; i < 40; i++) { const won = await p.locator('.ae-result').count(); if (won) break; const heal = await p.locator('.ae-panel button', {hasText: 'Лечение'}).isEnabled().catch(() => false); const meHp = await p.evaluate(() => { const bars = document.querySelectorAll('.ae-panel .ae-card:not(.ae-foe) .ae-bar:not(.is-mp) span'); return bars[0]?.textContent; }); const [cur, max] = (meHp || '1 / 1').replace(/\s/g, '').split('/').map(Number); await p.locator('.ae-panel button', {hasText: cur < max * 0.35 && heal ? 'Лечение' : 'Атака'}).first().click(); await p.waitForTimeout(300); }
console.log('duel result:', await p.locator('.ae-result').innerText().catch(() => 'none'));
await p.screenshot({path: `b5-duel-${style}.png`});
const claimBtn = p.locator('.ae-panel button', {hasText: 'Забрать'}); const g0 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.gold, key);
if (await claimBtn.count()) { await claimBtn.click(); await p.waitForTimeout(600); console.log('gold', g0, '->', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.gold, key)); }
await p.keyboard.press('Escape');
// promo: admin generates, then redeems
await p.evaluate(() => window.__aethBridge.api('/api/admin/promo', {method: 'POST', body: JSON.stringify({pack: 'starter'})}).then(r => window.__code = r.codes[0].code));
const code = await p.evaluate(() => window.__code); console.log('code', code);
await p.evaluate(() => window.__aethOpen.promo()); await p.waitForTimeout(400); await p.locator('.ae-panel .ae-input').fill(code); await p.locator('.ae-panel button', {hasText: 'Активировать'}).click(); await p.waitForTimeout(800);
console.log('promo toast:', await p.locator('.ae-toast').innerText(), 'gold now', await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.gold, key));
await p.keyboard.press('Escape');
// share item to chat
await p.locator('nav button', {hasText: /Сумка/}).first().click(); await p.waitForTimeout(1200);
await p.locator('[data-inventory-item="sh1"]').click(); await p.waitForTimeout(1200);
console.log('share btn', await p.locator('[data-ae-share]').count()); await p.screenshot({path: `b5-itemdlg-${style}.png`});
await p.locator('[data-ae-share]').first().click().catch(e => console.log('share fail')); await p.waitForTimeout(800);
console.log('chat last msg:', (s.world.tables.global_chat_messages.at(-1)?.text || '').slice(0, 80));
await p.keyboard.press('Escape'); await p.locator('button:text-is("×")').last().click().catch(() => {});
// chat screen: item card + clickable nick
await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.locator('.bottom-sheet-backdrop button, main button', {hasText: /^Чат/}).first().click(); await p.waitForTimeout(2500);
console.log('chat item cards', await p.locator('.ae-chat-item').count(), 'nicks', await p.locator('.ae-nick').count());
await p.screenshot({path: `b5-chat-${style}.png`});
if (await p.locator('.ae-nick').count()) { await p.locator('.ae-nick').first().click(); await p.waitForTimeout(500); console.log('player card:', await p.locator('.ae-panel').innerText().then(t => t.replace(/\n/g, ' ')).catch(() => 'none')); }
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
