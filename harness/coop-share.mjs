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
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const E = s.E;
const boris = (path, method, body) => handleSocialRequest(s.world, {path, method, body}, {id: 555}, Date.now()) .then(r => r || E.handleProgressRequest(s.world, {path, method, headers: {'x-game-reset-version': '0'}, body}, {id: 555, displayName: 'Борис'}, {now: () => Date.now()}));
await p.evaluate(() => window.__aethOpen.coop()); await p.waitForTimeout(800);
await p.locator('.ae-panel button', {hasText: 'Открыть'}).first().click(); await p.waitForTimeout(900);
await p.locator('.ae-coop-share').click(); await p.waitForTimeout(900);
const chat = () => JSON.stringify(s.world.tables).match(/Ищу отряд[^"]{0,80}/g);
console.log('chat after share:', chat());
await p.locator('.ae-coop-share').click(); await p.waitForTimeout(500); console.log('repeat toast:', await p.locator('.ae-toast').innerText());
// leave own room, Boris opens his room and shares it
await p.locator('.ae-panel button', {hasText: /Выйти из комнаты/}).click(); await p.waitForTimeout(900); await p.keyboard.press('Escape');
const br = await boris('/api/coop/create', 'POST', {dungeonId: 'spider_den'}); const room = br.body.room;
const o = {r: room.id, d: room.dungeon.name, i: room.dungeon.id, mn: room.dungeon.minLevel, mx: room.dungeon.maxLevel, h: 'Борис'};
const token = Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const pr = await boris('/api/chat/global', 'POST', {text: `🛡️ Ищу отряд в «${o.d}» (ур. ${o.mn}–${o.mx}) ⟦ae:c:${token}⟧`}); console.log('boris post', pr.status, pr.body?.error || '');
await p.locator('nav button').first().click(); await p.waitForTimeout(800);
await p.locator('[data-settlement-place="chat"]').first().click().catch(e => console.log('nochat')); await p.waitForTimeout(2500);
const tabs = p.getByRole('button', {name: /Общий|Мировой|Глобальный/}).first(); if (await tabs.count()) { await tabs.click().catch(() => {}); await p.waitForTimeout(1500); }
console.log('coop cards in chat:', await p.locator('.ae-chat-coop').count());
await p.locator('.ae-chat-coop').last().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({path: `coop-share-${style}.png`});
await p.locator('.ae-chat-coop button').last().click(); await p.waitForTimeout(1200);
console.log('joined:', s.world.tables.coop_rooms.find(r => r.id === room.id).members.map(m => m.name + (m.left ? '(left)' : '')).join(', '), '| panel:', await p.locator('.ae-panel h2').innerText().catch(() => '-'));
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
