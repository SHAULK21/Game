// NPC heroes («жители королевства») and the tavern's information board.
// NPCs are marked everywhere: their name ends with « · NPC». They live like players: they come online by a daily
// rhythm, level up over time, set Horde records, appear in ratings and talk in the tavern chat (greet newcomers,
// congratulate, answer simple questions — and say honestly that they are NPCs when asked).
// They never take real rewards: no season points, no Horde weekly prizes, no mentoring, no analytics.
// The board («📜 Доска королевства») collects important results of everyone: real players and NPCs.
// Everything runs lazily from requests (chat, board, world housekeeping): no scheduler.
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body});
const iso = t => new Date(t).toISOString();
const HOUR = 36e5, DAY = 864e5;

export const NPC_BASE = 7e15;
export const isNpc = id => { const n = Number(id); return n >= NPC_BASE && n < NPC_BASE + 1e6; };
export const NPC_MARK = ' · NPC';
// [name, class, start level, level cap, growth (levels a day early on), ♀]
const ROSTER = [
  ['Мирослава', 'mage', 18, 72, 2.2, 1], ['Тихон', 'warrior', 24, 80, 1.8, 0], ['Ярослав', 'paladin', 31, 85, 1.5, 0], ['Велена', 'druid', 12, 60, 2.4, 1],
  ['Дарен', 'assassin', 27, 78, 1.9, 0], ['Златка', 'archer', 9, 55, 2.6, 1], ['Радомир', 'knight', 36, 88, 1.3, 0], ['Весна', 'necromancer', 15, 66, 2.3, 1],
  ['Святогор', 'berserker', 42, 92, 1.1, 0], ['Лада', 'rogue', 21, 70, 2.0, 1], ['Остромир', 'mage', 6, 50, 2.8, 0], ['Белояра', 'paladin', 29, 82, 1.6, 1],
  ['Всеслав', 'necromancer', 33, 86, 1.4, 0], ['Забава', 'druid', 11, 58, 2.5, 1], ['Добрыня', 'warrior', 47, 95, 1.0, 0], ['Милана', 'assassin', 19, 74, 2.1, 1],
  ['Горислав', 'archer', 25, 77, 1.7, 0], ['Любава', 'knight', 14, 62, 2.3, 1], ['Ратибор', 'berserker', 38, 90, 1.2, 0], ['Снежана', 'mage', 23, 76, 1.9, 1],
];
const CLASS_RU = {warrior: 'Воин', berserker: 'Берсерк', knight: 'Рыцарь', rogue: 'Разбойник', assassin: 'Ассасин', archer: 'Лучник', mage: 'Маг', necromancer: 'Некромант', paladin: 'Паладин', druid: 'Друид'};
const npcId = i => String(NPC_BASE + i + 1);
const hash = (...a) => { let h = 2166136261; for (const c of a.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const pick = (list, ...seed) => list[Math.floor(hash(...seed) * list.length) % list.length];
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const plain = name => String(name || '').replace(NPC_MARK, '');
const nameOf = p => String(p?.character_name || p?.display_name || 'Герой').trim();
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const waves = k => `${k} ${plural(k, 'волну', 'волны', 'волн')}`;
const isReal = p => p && !isNpc(p.telegram_id) && p.character_name;

// online by a daily rhythm: more often in the daytime (UTC 7–21 = 9–23 in Kyiv), each NPC differently every day
export function npcOnline(i, now) {
  const d = new Date(now), h = d.getUTCHours(), day = iso(now).slice(0, 10);
  const p = h >= 7 && h < 21 ? 0.72 : h >= 21 || h < 1 ? 0.4 : 0.12;
  return hash('on', i, day, h) < p;
}

function state(world) { const t = rows(world, 'ae_npc_state'); if (!t[0]) t.push({tickAt: 0, chatAt: 0, pending: [], greeted: [], lv: {}, horde: {}, joined: []}); return t[0]; }
function npcRec(world, i) { const t = rows(world, 'ae_npc'); let r = t.find(x => x.i === i); if (!r) { r = {i, lvl: ROSTER[i][2] + hash('l', i), best: 0, at: 0}; t.push(r); } return r; }

export function boardPush(world, {icon, text, u = null, npc = false}, now = Date.now()) {
  const list = rows(world, 'ae_board'); list.push({id: (list.at(-1)?.id || 0) + 1, at: iso(now), icon, text: String(text).slice(0, 160), u: u ? String(u) : null, npc: !!npc});
  if (list.length > 80) world.tables.ae_board = list.slice(-80);
}

function ensureRows(world, now) {
  const players = rows(world, 'players');
  ROSTER.forEach(([name, cls, lvl], i) => {
    const id = npcId(i); let p = players.find(x => same(x.telegram_id, id));
    if (!p) {
      const born = now - (6 + Math.floor(hash('born', i) * 40)) * DAY;
      p = {telegram_id: id, username: null, display_name: name, reset_version: 0, progress_version: 0, progress_session_generation: 0, progress_session_hash: null, progress_migration_open: false,
        progress_json: null, character_authority: 'legacy-local', level: lvl, arena_rating: 1000 + Math.round((hash('ar', i) - 0.4) * 300), clan_id: null, market_gold: 0, premium_until: null,
        created_at: iso(born), updated_at: iso(now), last_seen_at: iso(now - HOUR), bot_started: false, preferred_language: 'ru', preferred_interface: 'classic', notification_settings: {}, referred_by: null};
      players.push(p);
    }
    p.character_name = name + NPC_MARK; p.class_id = cls;
  });
}

const RECORD_KILLS = L => Math.round(20 + L * 1.6);
const LOOT = ['Клинок Зимней Зари', 'Посох Шепчущих Теней', 'Лук Серебряного Ветра', 'Латы Драконьего Пепла', 'Амулет Кровавой Луны', 'Кинжал Безмолвной Ночи', 'Щит Рассветной Стражи', 'Кольцо Древнего Леса'];
// levels, online marks, records and the board — at most every few minutes
export function npcTick(world, now = Date.now()) {
  const st = state(world); if (now - st.tickAt < 3 * 60e3) return; const hours = st.tickAt ? Math.min(48, (now - st.tickAt) / HOUR) : 0; st.tickAt = now;
  ensureRows(world, now);
  ROSTER.forEach(([name, cls, , cap, rate, fem], i) => {
    const p = player(world, npcId(i)), r = npcRec(world, i), on = npcOnline(i, now), L0 = Math.floor(r.lvl);
    if (on) { p.last_seen_at = iso(now); r.lvl = Math.min(cap, r.lvl + hours * rate / 14 * Math.max(0.25, 1.6 - r.lvl / 60)); }
    const L = Math.floor(r.lvl); p.level = L;
    if (L > L0 && L % 5 === 0) boardPush(world, {icon: '⭐', text: `${name}${NPC_MARK} ${fem ? 'достигла' : 'достиг'} ${L} уровня`, u: p.telegram_id, npc: true}, now);
    if (on && hours > 0 && hash('ev', i, Math.floor(now / HOUR)) < 0.06 * Math.min(3, hours)) {
      const kind = hash('kind', i, Math.floor(now / HOUR));
      if (kind < 0.45) { const k = Math.round(RECORD_KILLS(L) * (0.8 + hash('k', i, now) * 0.6)); if (k > r.best) { r.best = k; boardPush(world, {icon: '🌊', text: `${name}${NPC_MARK} ${fem ? 'прошла' : 'прошёл'} ${waves(k)} Орды — личный рекорд`, u: p.telegram_id, npc: true}, now); } }
      else if (kind < 0.75) boardPush(world, {icon: '💎', text: `${name}${NPC_MARK} ${fem ? 'добыла' : 'добыл'} легендарный предмет «${pick(LOOT, 'loot', i, now)}»`, u: p.telegram_id, npc: true}, now);
      else boardPush(world, {icon: '🔨', text: `${name}${NPC_MARK} ${fem ? 'заточила' : 'заточил'} оружие до +${8 + Math.floor(L / 12)}`, u: p.telegram_id, npc: true}, now);
    }
    p.arena_rating = Math.max(800, Math.min(1500, Math.round((Number(p.arena_rating) || 1000) + (hash('arena', i, Math.floor(now / HOUR)) - 0.48) * 12 * Math.min(3, hours))));
  });
  // real players: new heroes, every 5th level from 10, Horde records — the board and a word in the chat
  const lv = st.lv, hb = st.horde, first = !Object.keys(lv).length;
  for (const p of rows(world, 'players')) {
    if (!isReal(p)) continue; const id = String(p.telegram_id), L = Number(p.level) || 1;
    if (!first && lv[id] == null && now - (Date.parse(p.created_at) || 0) < 2 * DAY && !st.joined.includes(id)) {
      st.joined.push(id); boardPush(world, {icon: '🌱', text: `В королевство прибыл новый герой: ${nameOf(p)} (${CLASS_RU[p.class_id] || 'герой'})`, u: id}, now);
      st.pending.push({due: now + 4000 + hash('g', id) * 20000, text: pick(GREET_NEW, 'gn', id).replace('{name}', nameOf(p)), by: pickOnline(world, now, id)});
    }
    if (!first && lv[id] != null && Math.floor(L / 5) > Math.floor(lv[id] / 5) && L >= 10) {
      boardPush(world, {icon: '⭐', text: `${nameOf(p)} — уже ${Math.floor(L / 5) * 5} уровень!`, u: id}, now);
      if (hash('cg', id, L) < 0.6) st.pending.push({due: now + 6000 + hash('cgd', id, L) * 30000, text: pick(CONGRATS, 'cg', id, L).replace('{name}', nameOf(p)).replace('{lvl}', Math.floor(L / 5) * 5), by: pickOnline(world, now, id + L)});
    }
    lv[id] = L;
  }
  for (const b of rows(world, 'horde_best')) {
    const id = String(b.user), p = player(world, id); if (!isReal(p)) continue; const k = Number(b.kills) || 0;
    if (hb[id] != null && k >= 30 && k >= hb[id] + 5) boardPush(world, {icon: '🌊', text: `${nameOf(p)}: новый рекорд Орды — ${waves(k)}!`, u: id}, now);
    hb[id] = Math.max(hb[id] || 0, k);
  }
  st.joined = st.joined.slice(-100); st.greeted = st.greeted.slice(-200);
}

function pickOnline(world, now, seed) {
  const on = ROSTER.map((_, i) => i).filter(i => npcOnline(i, now)); const list = on.length ? on : ROSTER.map((_, i) => i);
  return npcId(list[Math.floor(hash('who', seed, now) * list.length) % list.length]);
}

// ---------- the tavern chat ----------
const GREET_NEW = ['Добро пожаловать в Аэтельгард, {name}! Если что-то непонятно — спрашивай тут 🙂', 'О, новенький! Привет, {name} 👋 Начни с охоты и не забывай про навыки в бою', '{name}, привет! Загляни в «Путь новичка» внизу экрана — там награды за первые шаги', 'Приветствуем, {name}! В Орде первые волны лёгкие, попробуй 😉'];
const CONGRATS = ['{name}, поздравляю с {lvl} уровнем! 🎉', 'Ого, {name} уже {lvl}! Растёшь быстро 💪', 'С {lvl} уровнем, {name}! 🥳', '{name}, {lvl} — красиво! Дальше будет интереснее'];
const IDLE = ['Кто в Орду? Говорят, сегодня волны злые 😅', 'Наконец-то докачал алхимию, теперь зелья варю пачками', 'Рыбалка у причала сегодня отличная, трёх щук поймал', 'Кто знает, где лучше фармить серебро?', 'Заточка до +10 съела всё золото… но оно того стоило ⚔️', 'В Шепчущем лесу опять бродячий босс, кто со мной?', 'Ищу клан, активный, без токсиков 🙂', 'Шахта сегодня щедрая: две жилы мифрила подряд', 'Ох уж эта Кровавая луна… три раза падал на 40-й волне', 'Кто-нибудь пробовал связки навыков некроманта? Урон огонь', 'Вчера на арене выбил Серебряную лигу 🏆', 'Совет новичкам: не копите очки характеристик, сразу распределяйте', 'Соратник-лекарь — лучшая покупка, жить стало проще', 'Кто тоже ждёт конца сезона? Хочу титул «Героя» 🥇', 'Утренний поход в пещеры — лучший кофе ☕', 'Продам лишние руды, пишите', 'Питомец снова голодный, пойду рыбачить для него 🐟', 'Наш клан строит Цитадель, скоро пойдём за землями', 'Кто-нибудь уже дошёл до Драконьей Твердыни?', 'Награда за вход седьмой день — Премиум на сутки, не пропускайте 😉'];
const ANSWERS = [
  [/(бот|npc|нпс|нпц|живой|настоящ|человек)/i, ['Я NPC — житель королевства 🙂 У нас пометка «NPC» в имени. Живые герои — без неё', 'Да, я NPC. Но поболтать и подсказать всегда рад!']],
  [/(как|где).{0,20}(кач|уров|опыт|прокач)/i, ['Охота + Орда + задания. На первых уровнях жми навыки — они бьют сильнее атаки', 'Мне помогла Орда и дневные задания. И «Путь новичка», если ты недавно пришёл']],
  [/(где|как).{0,20}(золот|денег|деньг|серебр)/i, ['Орда и продажа лишнего на рынке. Ещё шахта неплохо кормит', 'Продавай ненужные вещи и рыбу, а в Орде золото хорошее']],
  [/клан/i, ['Клан даёт бонусы и сундук. В таверне есть поиск кланов', 'Вступай в клан — вместе и боссы проще, и крепость строить веселее']],
  [/(премиум|premium)/i, ['Премиум — автобой и офлайн-добыча. Сутки дают за 7 дней входа подряд', 'На седьмой день награды за вход дают Премиум на сутки, попробуй']],
  [/(орд|волн)/i, ['В Орде главное — брать дары на 10-й, 30-й волне. Ярость или Стойкость', 'Я в Орде беру Кровопийцу, хорошо лечит']],
  [/(арен|дуэл|pvp|пвп)/i, ['На арене сначала гладиаторы, потом лиги. Вызывай, если что 😉', 'Дуэли — весело, но сначала прокачай защиту']],
  [/^(всем )?(привет|прив|здравств|хай|ку|добр|салам|хелло|hello|hi)\b/i, ['Привет! 👋', 'Привет-привет!', 'Здравствуй, герой!', 'Хай 🙂', 'Привет! Как успехи?']],
  [/(спасиб|благодар|thx|thanks)/i, ['Обращайся 🙂', 'Да не за что!', 'Удачи в походах!']],
];
function insertMsg(world, by, text, now) {
  const list = rows(world, 'global_chat_messages'), id = list.reduce((a, m) => Math.max(a, Number(m.id) || 0), 0) + 1;
  list.push({id, telegram_id: by, text, created_at: iso(now)});
}
// called when the chat is polled: due replies, and now and then a line from an NPC that is online
export function npcChatTick(world, now = Date.now()) {
  npcTick(world, now);
  const st = state(world);
  const due = st.pending.filter(x => x.due <= now); st.pending = st.pending.filter(x => x.due > now).slice(-20);
  for (const x of due.slice(0, 3)) insertMsg(world, x.by, x.text, now);
  const h = new Date(now).getUTCHours(), gap = (h >= 7 && h < 21 ? 7 : 25) * 60e3 * (0.7 + hash('gap', Math.floor(now / 60e3)) * 0.8);
  const last = rows(world, 'global_chat_messages').reduce((a, m) => Math.max(a, Date.parse(m.created_at) || 0), 0);
  if (now - Math.max(st.chatAt, last) > gap) { st.chatAt = now; const by = pickOnline(world, now, 'idle'); insertMsg(world, by, pick(IDLE, 'idle', by, Math.floor(now / 60e3)), now); }
}
// a real player wrote in the chat: maybe an NPC answers in a few seconds
export function npcOnPlayerMessage(world, me, text, now = Date.now()) {
  if (isNpc(me)) return; const st = state(world), t = String(text || '').replace(/⟦ae:[^⟧]*⟧/g, '').trim(); if (!t) return;
  const named = ROSTER.findIndex(([n]) => t.toLowerCase().includes(n.toLowerCase()));
  const rule = ANSWERS.find(([re]) => re.test(t)); if (!rule && named < 0) return;
  if (hash('ans', me, now) > (named >= 0 ? 0.95 : 0.75)) return;
  const by = named >= 0 ? npcId(named) : pickOnline(world, now, me);
  const name = nameOf(player(world, me));
  const line = rule ? pick(rule[1], 'a', me, now) : pick(['Я тут! Что такое, {name}?', '{name}, слушаю 🙂', 'Звали? 😄'], 'nm', me, now).replace('{name}', name);
  st.pending.push({due: now + 3500 + hash('d', me, now) * 9000, text: line, by});
}

// ---------- online counter and the board ----------
export function onlineNow(world, now = Date.now()) {
  const real = rows(world, 'players').filter(p => isReal(p) && now - (Date.parse(p.last_seen_at || 0) || 0) < 10 * 60e3).length;
  return {players: real, npc: ROSTER.filter((_, i) => npcOnline(i, now)).length};
}
export function handleBoard(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0]; if (path !== '/api/ae-board') return null;
  npcTick(world, now);
  const list = rows(world, 'ae_board').slice(-40).reverse();
  return ok({items: list, online: onlineNow(world, now)});
}
// NPC friend requests are accepted at once (an NPC never leaves a request hanging)
export function npcAcceptFriends(world, now = Date.now()) {
  for (const f of rows(world, 'friendships')) if (f.status === 'pending' && String(f.pair || '').split(':').some(isNpc) && !isNpc(f.requester)) { f.status = 'accepted'; f.updated_at = iso(now); }
}
