import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, gold: 12400, silver: 3800, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99, currentRegionId: 'reg_whisper_woods', unlockedRegionIds: ['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
const gear = (id, name, type, rarity, lvl, up, asc, stats) => ({id, templateId: id, name, type, rarity, level: lvl, upgradeLevel: up, ascension: asc, stats, icon: '?', sellPrice: 50, disassembleYield: {}, stackCount: 1});
save.player.inventory.push(gear('g1', 'Клинок сумеречного леса', 'weapon', 'epic', 28, 7, 2, {attack: 140}), gear('g2', 'Шлем дозорного', 'helmet', 'rare', 25, 4, 0, {defense: 60}), gear('g3', 'Латный доспех рыцаря', 'armor', 'legendary', 30, 9, 3, {defense: 150}),
  gear('g4', 'Кольцо эхолокации', 'ring', 'epic', 26, 3, 1, {critChance: 6}), gear('g5', 'Сапоги ветра', 'boots', 'uncommon', 20, 2, 0, {defense: 30}), gear('g6', 'Амулет бездны', 'amulet', 'mythic', 30, 5, 2, {magicAttack: 90}));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy';
ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp', 'reg_desert', 'reg_cursed', 'reg_rift', 'reg_dragon']); ls['aeth_coop_story_437290420'] = '1';
const s = await launch({localState: ls, pageOptions: {viewport: {width: 1080, height: 1920}, deviceScaleFactor: 1, recordVideo: {dir: 'video', size: {width: 1080, height: 1920}}},
  setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
    Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 28, class_id: 'druid'}); Object.assign(w.tables.players.find(p => p.telegram_id == 437290420), {level: 30, class_id: 'warrior', character_name: 'Админ'}); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page, t0 = Date.now(), marks = []; p.setDefaultTimeout(4000);
const mark = n => { marks.push([n, (Date.now() - t0) / 1000]); console.log('mark', n, ((Date.now() - t0) / 1000).toFixed(1)); };
const W = ms => p.waitForTimeout(ms);
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const boris = (path, body) => handleSocialRequest(s.world, {path, method: 'POST', body}, {id: 555}, Date.now());
await p.addStyleTag({content: `html{zoom:2.5}.ae-pop,.ae-toast{display:none!important}.tt-cap{position:fixed;left:14px;right:14px;top:58px;z-index:9999;text-align:center;pointer-events:none;font:900 26px/1.15 Georgia,serif;color:#fff3d0;text-shadow:0 2px 0 #000,0 0 18px #000,0 0 6px #000;opacity:0;transform:translateY(-10px) scale(.96);transition:all .35s}
.tt-cap small{display:block;margin-top:6px;font:700 15px/1.3 system-ui,sans-serif;color:#ffd36a}.tt-cap.on{opacity:1;transform:none}
.tt-full{position:fixed;inset:0;z-index:9998;pointer-events:none;background:#000 center/cover;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 22px 120px;text-align:center;transition:opacity .5s}
.tt-full h1{font:900 40px/1.05 Georgia,serif;color:#ffe6a8;margin:0 0 10px;text-shadow:0 3px 0 #000,0 0 30px #000}.tt-full p{font:700 18px/1.35 system-ui,sans-serif;color:#fff;margin:0;text-shadow:0 2px 6px #000}
.tt-full b.cta{margin-top:18px;padding:12px 22px;border-radius:14px;background:linear-gradient(#f0cf7a,#c99a3c);color:#1d1408;font:900 19px system-ui,sans-serif;box-shadow:0 6px 24px #000c}`});
const cap = (t, sub = '') => p.evaluate(([t, sub]) => { document.querySelectorAll('.tt-cap').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'tt-cap'; d.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); document.body.append(d); requestAnimationFrame(() => d.classList.add('on')); }, [t, sub]);
const full = (img, h1, ptxt, cta = '') => p.evaluate(([img, h1, ptxt, cta]) => { document.querySelectorAll('.tt-full').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'tt-full'; d.style.backgroundImage = `linear-gradient(transparent 35%,#000d 80%),url(${img})`; d.innerHTML = `<h1>${h1}</h1><p>${ptxt}</p>${cta ? `<b class="cta">${cta}</b>` : ''}`; document.body.append(d); }, [img, h1, ptxt, cta]);
const unfull = () => p.evaluate(() => document.querySelectorAll('.tt-full').forEach(e => { e.style.opacity = 0; setTimeout(() => e.remove(), 500); }));
const nocap = () => p.evaluate(() => document.querySelectorAll('.tt-cap').forEach(e => e.remove()));
await p.evaluate(() => { for (let i = 1; i <= 5; i++) new Image().src = `/assets/travel/travel-${i}.webp`; ['/assets/story/coop-first-victory.webp', '/assets/story/first-boss.webp'].forEach(u => new Image().src = u); });
await W(5500);
for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.evaluate(() => document.querySelectorAll('.ae-pop,.ae-toast').forEach(e => e.remove()));
// 1. hook
await full('/assets/story/coop-first-victory.webp', 'Aethelgard RPG', 'Тёмное фэнтези прямо в Telegram'); mark('start'); await W(2600);
// 2. world
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await W(300); await unfull(); await cap('9 земель', 'и у каждой — свои чудовища'); await W(1200);
for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 400); await W(200); } await W(300);
// 3. travel + bestiary
await nocap(); await p.evaluate(() => scrollTo(0, 0));
const land = p.locator('main [role=button], main button').filter({hasText: /Шепчущий лес/}).first(); await land.click().catch(() => {}); await W(700);
await p.getByRole('button', {name: /Отправиться в путь/}).first().click().catch(() => {}); await cap('Походы', 'советы и истории в пути'); await W(3300);
await cap('Бестиарий', '18 новых монстров'); await W(600);
await p.evaluate(() => [...document.querySelectorAll('img')].find(i => /monsters\/v_/.test(i.src))?.scrollIntoView({block: 'center', behavior: 'smooth'})); await W(1800);
// 4. combat
await nocap(); await p.evaluate(() => scrollTo({top: 0, behavior: 'smooth'})); await W(400);
await p.getByRole('button', {name: /Начать охоту/i}).first().click().catch(e => console.log('no hunt')); await W(1500);
await cap('Пошаговые бои', 'читай приёмы врага'); 
for (let i = 0; i < 4; i++) { await p.getByRole('button', {name: /^Атака/}).first().click({timeout: 1500}).catch(() => {}); await W(900); }
mark('combat-end');
// 5. coop
await nocap(); await p.keyboard.press('Escape').catch(() => {});
await p.evaluate(() => window.__aethOpen.coop()); await W(700);
await p.locator('.ae-panel button', {hasText: 'Открыть'}).nth(1).click().catch(() => {}); await W(500);
const room = s.world.tables.coop_rooms?.at(-1); if (room) await boris('/api/coop/join', {roomId: room.id}); await W(1400);
await p.locator('.ae-panel button', {hasText: 'Начать поход'}).click().catch(() => {}); await W(900);
await cap('Кооп с друзьями', 'связки способностей'); 
for (let i = 0; i < 3; i++) { await p.locator('[data-ae-act="attack"]').click({force: true}).catch(() => {}); await boris('/api/coop/act', {action: 'attack'}); await W(700); }
await boris('/api/coop/act', {action: 'spell'}); await W(1300); await p.locator('[data-ae-act="spell"]').click({force: true}).catch(() => {}); await W(2300);
// 6. duel
await nocap(); await p.keyboard.press('Escape'); await W(300);
await p.evaluate(() => window.__aethOpen.duel()); await W(600); await p.locator('.ae-panel input').fill('Борис').catch(() => {}); await p.locator('.ae-panel button', {hasText: 'Бросить вызов'}).click().catch(() => {}); await W(900);
await cap('PvP-дуэли', 'навыки классов');
for (const re of [/Боевой клич/, /Сильный удар/, /Атака/]) { await p.locator('.ae-acts button').filter({hasText: re}).first().click({force: true}).catch(() => {}); await W(1100); }
// 7. bag
await nocap(); await p.keyboard.press('Escape'); await W(300);
await p.locator('nav button', {hasText: 'Сумка'}).first().click(); await W(400); await cap('Лут и заточка', '★ объединение вещей'); await W(1200);
await p.mouse.wheel(0, 450); await W(1300);
// 8. CTA
await nocap(); await full('/assets/story/first-boss.webp', 'Играй бесплатно', 'Прямо в Telegram — без установки', '@Aethelgardr_RPG_Bot'); await W(3200); mark('end');
const vp = await p.video().path(); await p.close(); await s.close();
fs.writeFileSync('video/marks.json', JSON.stringify({vp, marks}));
console.log('video', vp);
