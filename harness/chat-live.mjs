import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const base = w.tables.players[0]; w.tables.players.push({...base, telegram_id: 555, character_name: 'Борис', level: 16, class_id: 'druid'}, {...base, telegram_id: 556, character_name: 'Вика', level: 12, class_id: 'mage'}); const t = Date.now(); const L = 'Длинное сообщение: ' + 'очень много текста про походы, боссов и кланы, '.repeat(9); const rowsC = [[555,'Вчера был отличный рейд!',26*36e5],[556,'Да, Пралич упал за 3 минуты',25.9*36e5],[555,'Всем привет! Кто идёт в кооп?',6e5],[556,'Я! Только зелья сварю',5e5],[437290420,'Через 5 минут буду',4e5],[555,'Отлично, жду в лобби',3e5],[556,'Кто знает где найти Драконью искру? @Админ подскажешь?',2e5],[555,L.slice(0,500),1e5],[556,'Смотрите, что выбила: ⟦ae:i:eyJuIjogItCc0LXRhyDQoNGL0YbQsNGA0Y8t0J/RgNC40LfRgNCw0LrQsCIsICJyIjogImVwaWMiLCAibCI6IDIwLCAicyI6IHsiYXR0YWNrIjogMTJ9fQ==⟧',5e4]];
    (w.tables.global_chat_messages ||= []).push(...rowsC.map(([u,m,ago],i)=>({id: i+1, telegram_id: u, text: m, created_at: new Date(t - ago).toISOString()})));
    (w.tables.ae_chat_meta ||= []).push({id: '6', reply: {id: '5', uid: '437290420', name: 'Админ', text: 'Через 5 минут буду'}}); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const st = process.argv[2] || 'modern';
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Поселение/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(3000);
console.log('TXT', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 1800));
const push = (u, text) => { const L = s.world.tables.global_chat_messages; L.push({id: L.reduce((a, m) => Math.max(a, Number(m.id)), 0) + 1, telegram_id: u, text, created_at: new Date().toISOString()}); };
console.log('CARD', await p.evaluate(() => !!document.querySelector('.chat-message .ae-chat-item')));
await p.evaluate(() => document.querySelector('.chat-message .ae-chat-item')?.click()); await p.waitForTimeout(500);
console.log('MENU after card tap', await p.evaluate(() => !!document.querySelector('.ae-chat-menu')));
await p.evaluate(() => { const st = document.querySelector('#tavern-chat .chat-stream'); st.scrollTop = 0; }); await p.waitForTimeout(1000);
push(555, 'Новое сообщение, пока вы читаете старые'); push(556, 'И ещё одно'); await p.waitForTimeout(12000);
console.log('PILL', await p.evaluate(() => document.querySelector('.ae-chat-newpill')?.textContent || '-'));
console.log('PILLDBG', JSON.stringify(await p.evaluate(() => { const pl = document.querySelector('.ae-chat-newpill'); if (!pl) return null; const f = pl.parentElement, cs = getComputedStyle(f), pcs = getComputedStyle(pl); return {parent: f.tagName + '.' + f.className.slice(0, 60), pos: cs.position, h: f.getBoundingClientRect().height, pillPos: pcs.position, pillBottom: pcs.bottom, pillTop: Math.round(pl.getBoundingClientRect().top), formTop: Math.round(f.getBoundingClientRect().top), transform: pcs.transform}; })));
await p.screenshot({path: `chat-${st}-5.png`});
await p.evaluate(() => document.querySelector('.ae-chat-newpill')?.click()); await p.waitForTimeout(1500);
console.log('PILL after click', await p.evaluate(() => document.querySelector('.ae-chat-newpill')?.textContent || '-'));
// own message delete
await p.evaluate(() => [...document.querySelectorAll('.chat-message.is-own')].slice(-1)[0]?.querySelector('.chat-message-text').click()); await p.waitForTimeout(500);
await p.evaluate(() => [...document.querySelectorAll('.ae-chat-menu button')].find(b => /Удалить/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
console.log('DEL', await p.evaluate(() => [...document.querySelectorAll('.chat-message.is-own')].map(m => m.dataset.aeGone + ':' + getComputedStyle(m.querySelector('.chat-message-text'), '::after').content).join(' ')));
// leave the tavern: badge on the round chat button
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Мир/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
push(555, 'Где все?'); push(556, 'Я тут'); push(555, 'Го в рейд');
await p.waitForTimeout(32000);
console.log('BADGE', await p.evaluate(() => document.querySelector('.ae-chat-fab-n')?.textContent || '-'));
await p.screenshot({path: `chat-${st}-6.png`});
await s.close(); process.exit(0);
