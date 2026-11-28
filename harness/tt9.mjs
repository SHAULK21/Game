// TikTok video #7: «text card → the change in the game» three times (live battles, NPC in the tavern chat, the kingdom
// board), then the call to play. Recorded as fast screenshots at 1080×1920 (432×768 css px ×2.5): the browser's
// video recorder drops frames and misses short animations (the battle dashes).
// Usage: node tt9.mjs  → video/tt9/<clip>/f*.jpg + list.txt ; then python3 tt9_build.py <out.mp4>
import {launch} from './browser.mjs'; import fs from 'node:fs';
const OUT = 'video/tt9', ME = '437290420', KEY = 'aethelgard_save_v1_data_' + ME, PROMO = 'TT-KOROL';
fs.mkdirSync(OUT, {recursive: true});
const VIEW = {viewport: {width: 432, height: 768}, deviceScaleFactor: 2.5};
const CSS = `.ae-pop,.ae-apk-hint,.ae-toast,.ae-path-pill{display:none!important}
.tt-card{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;justify-content:center;padding:0 22px;background:linear-gradient(#0b080699,#0b0806d9 55%,#0b0806f2),url(/assets/story/courtyard.webp) center/cover;font-family:Georgia,serif}

.tt-card small{font:800 15px system-ui,sans-serif;letter-spacing:3px;color:#f0cf7a;margin-bottom:10px;animation:ttin .4s both}
.tt-card h1{font:900 44px/1.05 Georgia,serif;color:#ffe6a8;margin:0 0 26px;text-shadow:0 3px 0 #000,0 0 26px #000;animation:ttin .45s .1s both}
.tt-card .row{display:flex;gap:12px;align-items:flex-start;margin:11px 0;padding:15px 16px;border-radius:16px;background:#000b;border:2px solid #f0cf7a77;font:800 21px/1.25 system-ui,sans-serif;color:#fff3d6;animation:ttin .45s both}
.tt-card .row b{font-size:27px;line-height:1}.tt-card .row:nth-of-type(1){animation-delay:.45s}.tt-card .row:nth-of-type(2){animation-delay:.9s}.tt-card .row:nth-of-type(3){animation-delay:1.35s}
.tt-card .promo{margin-top:18px;padding:14px;border-radius:14px;background:linear-gradient(#f0cf7a,#c99a3c);color:#1d1408;text-align:center;font:900 30px system-ui,sans-serif;animation:ttin .45s 1.6s both}.tt-card .promo span{display:block;font-size:12px;font-weight:700;opacity:.8}
.tt-cap{position:fixed;left:0;right:0;top:0;z-index:2147483500;padding:12px 10px 16px;text-align:center;background:linear-gradient(#000d,#0000);font:900 21px/1.15 Georgia,serif;color:#fff3d0;text-shadow:0 2px 0 #000,0 0 14px #000;pointer-events:none}
.tt-cap span{display:block;font:800 12.5px system-ui,sans-serif;color:#ffd36a;margin-top:4px}
@keyframes ttin{from{opacity:0;transform:translateY(14px) scale(.96)}}`;

// fast screenshots while `work` runs (and `tail` ms more)
async function capture(p, name, work, tail = 0) {
  const dir = `${OUT}/${name}`; fs.rmSync(dir, {recursive: true, force: true}); fs.mkdirSync(dir, {recursive: true});
  const frames = []; let on = true; const t0 = Date.now();
  const loop = (async () => { while (on) { const f = `f${String(frames.length).padStart(4, '0')}.jpg`; await p.screenshot({path: `${dir}/${f}`, type: 'jpeg', quality: 86}); frames.push([f, Date.now() - t0]); } })();
  await work(); if (tail) await p.waitForTimeout(tail); on = false; await loop;
  let list = ''; for (let i = 0; i < frames.length; i++) list += `file '${frames[i][0]}'\nduration ${(((frames[i + 1]?.[1] ?? frames[i][1] + 60) - frames[i][1]) / 1000).toFixed(3)}\n`;
  fs.writeFileSync(`${dir}/list.txt`, list + `file '${frames.at(-1)[0]}'\n`);
  console.log(name, frames.length, 'frames,', (frames.at(-1)[1] / 1000).toFixed(1), 's');
}
const click = (p, re) => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
const cap = (p, t, sub) => p.evaluate(([t, sub]) => { document.querySelector('.tt-cap')?.remove(); const d = document.createElement('div'); d.className = 'tt-cap'; d.innerHTML = t + (sub ? `<span>${sub}</span>` : ''); document.body.append(d); }, [t, sub]);
const CARDS = [
  ['ОБНОВЛЕНИЕ · 1/3', '⚔️ Бои стали живее', [['🏃', 'Герой бросается к врагу и бьёт'], ['💥', 'От удара монстр отлетает назад'], ['🛡️', '«Защита» — золотое сияние']]],
  ['ОБНОВЛЕНИЕ · 2/3', '🏘️ Жители королевства', [['🧝', 'NPC-герои качаются и ставят рекорды'], ['💬', 'Встречают новичков в чате таверны'], ['❓', 'Подсказывают, как играть']]],
  ['ОБНОВЛЕНИЕ · 3/3', '📜 Доска королевства', [['🟢', 'Кто сейчас в королевстве'], ['⭐', 'Уровни, рекорды Орды, захваты земель'], ['🏆', 'Итоги недели — у всех на виду']]],
];
const cardHtml = ([tag, title, rows]) => `<small>${tag}</small><h1>${title}</h1>${rows.map(([i, t]) => `<div class="row"><b>${i}</b><span>${t}</span></div>`).join('')}`;

async function cards() {
  const s = await launch({localState: {aethelgard_interface_style: 'fantasy'}, pageOptions: VIEW}); const p = s.page;
  await p.waitForTimeout(4000); await p.addStyleTag({content: CSS});
  for (let i = 0; i < CARDS.length; i++) {
    await capture(p, 'card' + (i + 1), async () => { await p.evaluate(html => { document.querySelector('.tt-card')?.remove(); const d = document.createElement('div'); d.className = 'tt-card'; d.innerHTML = html; document.body.append(d); }, cardHtml(CARDS[i])); }, 3600);
  }
  await capture(p, 'cta', async () => { await p.evaluate(PROMO => { document.querySelector('.tt-card')?.remove(); const d = document.createElement('div'); d.className = 'tt-card';
    d.innerHTML = `<small>ИГРАЙ ПРЯМО В TELEGRAM</small><h1>Aethelgard RPG</h1><div class="row"><b>🎮</b><span>@Aethelgardr_RPG_Bot</span></div><div class="promo"><span>Промокод на старт</span>🎁 ${PROMO}</div>`; document.body.append(d); }, PROMO); }, 4200);
  await s.close();
}
async function battle() {
  const ls = JSON.parse(fs.readFileSync('ls.json')); const save = JSON.parse(ls[KEY]);
  Object.assign(save.player, {level: 9, worldPlace: 'settlement', royalBriefingStep: 99, name: 'Арина', classId: 'warrior', unlockedRegionIds: ['reg_plains', 'reg_whisper_woods']}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
  ls[KEY] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_daily_seen_' + ME] = new Date().toISOString().slice(0, 10);
  ls['aeth_story_seen_v2_' + ME] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']);
  const s = await launch({localState: ls, pageOptions: VIEW, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')));
    const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) Object.assign(me, {level: 9, character_name: 'Арина', class_id: 'warrior'}); }});
  const p = s.page; p.setDefaultTimeout(4000); await p.waitForTimeout(7000);
  const closeAll = () => p.evaluate(() => { document.querySelectorAll('.ae-story button').forEach(b => b.click()); document.querySelector('.ae-x')?.click(); for (const t of ['Позже', 'В бой, герой!', 'Понятно', 'Закрыть']) [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t)?.click(); });
  for (let k = 0; k < 3; k++) { await closeAll(); await p.waitForTimeout(500); }
  await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Мир/.test(b.textContent))?.click()); await p.waitForTimeout(900);
  await p.locator('main [role=button], main button').filter({hasText: /Шепчущ/}).first().click().catch(() => {}); await p.waitForTimeout(500);
  await p.getByRole('button', {name: /Отправиться в путь/}).first().click().catch(() => {});
  for (let i = 0; i < 40; i++) { const b = (await p.getByRole('button').allInnerTexts()).map(x => x.trim()); if (b.some(x => /^атака$/i.test(x))) break;
    const go = b.find(x => /^Начать охоту|^Отправиться ·|^Сразиться|^В бой/i.test(x)); if (go) await p.getByRole('button', {name: go}).first().click().catch(() => {}); await closeAll(); await p.waitForTimeout(500); }
  await p.waitForTimeout(900); await p.addStyleTag({content: CSS}); await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'}));
  const top = () => p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'}));
  await capture(p, 'battle', async () => {
    await cap(p, '⚔️ Рывок и удар', 'монстр отлетает назад'); await p.waitForTimeout(300);
    await click(p, /^Атака$/); await p.waitForTimeout(150); await top(); await p.waitForTimeout(2600);
    await cap(p, '🛡️ Защита', 'золотое сияние'); await click(p, /^Защита/); await p.waitForTimeout(150); await top(); await p.waitForTimeout(2500);
    await cap(p, '⚔️ Ещё удар!'); await click(p, /^Атака$/); await p.waitForTimeout(150); await top(); await p.waitForTimeout(2400);
  });
  await s.close();
}
async function tavern() {
  const ls = JSON.parse(fs.readFileSync('ls.json')); const save = JSON.parse(ls[KEY]);
  Object.assign(save.player, {level: 12, worldPlace: 'settlement', royalBriefingStep: 99, name: 'Арина'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
  ls[KEY] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_daily_seen_' + ME] = new Date().toISOString().slice(0, 10);
  const N = await import('../tgcloud/lib/npc.js');
  const s = await launch({localState: ls, pageOptions: VIEW, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')));
    const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) Object.assign(me, {level: 12, character_name: 'Арина', class_id: 'warrior', last_seen_at: new Date().toISOString()});
    const t = Date.now(); N.npcTick(w, t - 3600e3); w.tables.ae_npc_state[0].chatAt = t;   // NPCs exist; no random line during the take
    const id = i => String(N.NPC_BASE + i + 1), msg = (i, text, ago) => (w.tables.global_chat_messages ||= []).push({id: (w.tables.global_chat_messages.length || 0) + 1, telegram_id: id(i), text, created_at: new Date(t - ago * 6e4).toISOString()});
    msg(1, 'Кто в Орду? Говорят, сегодня волны злые 😅', 9); msg(7, 'Я! Только зелья сварю 🧪', 8); msg(15, 'Вчера на арене выбил Серебряную лигу 🏆', 4);
    const B = (icon, text, npc, ago) => w.tables.ae_board.push({id: w.tables.ae_board.length + 1, at: new Date(t - ago * 6e4).toISOString(), icon, text, npc});
    w.tables.ae_board = [];
    B('🥇', 'Орда, итоги недели: 1-е место — Тихон · NPC, 186 монстров за поход', true, 300); B('🚩', 'Клан [ЛЕВ] захватил «Лесной кордон». Последний удар — Борис', false, 200);
    B('🌱', 'В королевство прибыл новый герой: Мира (Некромант)', false, 90); B('💎', 'Милана · NPC добыла легендарный предмет «Кинжал Безмолвной Ночи»', true, 60);
    B('🌊', 'Арина: новый рекорд Орды — 64 волны!', false, 25); B('⭐', 'Ярослав · NPC достиг 35 уровня', true, 12); B('⭐', 'Арина — уже 10 уровень!', false, 3);
    w.tables.ae_npc_state[0].tickAt = t; }});
  const p = s.page; await p.waitForTimeout(7000);
  for (let k = 0; k < 3; k++) { await p.evaluate(() => { document.querySelectorAll('.ae-story button').forEach(b => b.click()); document.querySelector('.ae-x')?.click(); for (const t of ['Позже', 'В бой, герой!', 'Понятно', 'Закрыть']) [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t)?.click(); }); await p.waitForTimeout(500); }
  await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Поселение/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(4500);
  await p.addStyleTag({content: CSS});
  await capture(p, 'tavern', async () => {
    await cap(p, '💬 NPC в чате таверны', 'встречают и подсказывают'); await p.waitForTimeout(1600);
    await p.click('#tavern-chat .chat-composer input'); await p.keyboard.type('Всем привет! Как быстро качаться?', {delay: 45});
    await p.evaluate(() => document.querySelector('#tavern-chat .chat-composer').requestSubmit());
    s.world.tables.ae_npc_state[0].pending.push({due: Date.now() + 1800, by: String(N.NPC_BASE + 8), text: 'Привет, Арина! Охота + Орда + задания. И жми навыки — они бьют сильнее атаки 💪'});
    await p.waitForTimeout(5600);
  });
  await capture(p, 'board', async () => {
    await cap(p, '📜 Доска королевства', 'игроки и NPC — все события'); await p.evaluate(() => window.__aethOpen.board()); await p.waitForTimeout(4600);
  });
  await s.close();
}
const which = process.argv[2] || 'all';
for (const [k, fn] of Object.entries({cards, battle, tavern})) if (which === 'all' || which.split(',').includes(k)) { try { await fn(); } catch (e) { console.log(k, 'failed', e.stack); } }
process.exit(0);
