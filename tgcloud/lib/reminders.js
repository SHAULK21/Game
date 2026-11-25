// Bringing players back through the bot.
// • Bot messages are on by default for everyone who started the bot (the game used to wait until the player turned
//   them on, and almost nobody did); a player who turned them off stays off.
// • Three reminders, one per account, only in the daytime: the daily login reward is waiting (the streak would break),
//   «your hero misses you» after 3 days away (with a gift in the mail) and after 7 days, and «you have not created
//   a hero yet» for those who opened the game but stopped at the class screen.
// Runs with the world housekeeping (pruneWorld), so it needs no scheduler.
import {isAlt, accountIds} from './alts.js';

const DAY = 864e5, APP = 'https://app8958621621.tgcloud.ai/';
const iso = t => new Date(t).toISOString(), same = (a, b) => String(a) === String(b);
const OFF_HINT = '\n\n🔕 Отключить сообщения: в игре 🔔 → «Сообщения от бота».';
const seenOf = p => { const t = Date.parse(p?.last_seen_at || 0) || 0; return t > Date.parse('2020-01-01') ? t : 0; };

export function notifyDefaults(world, now = Date.now()) {
  for (const p of world.tables.players || []) {
    if (!p.bot_started || p.notification_settings?.enabled !== undefined) continue;   // an explicit choice is kept
    p.notification_settings = {...(p.notification_settings || {}), enabled: true, onboardingSeen: true, autoOn: true};
    // nothing old piles up in the chat on the first day: unsent game notifications older than a day are closed
    for (const n of world.tables.game_notifications || []) if (same(n.telegram_id, p.telegram_id) && !n.sent_at && (Date.parse(n.due_at) || 0) < now - DAY) { n.sent_at = iso(now); n.read_at ||= iso(now); }
  }
}

export function returnReminders(world, now = Date.now()) {
  const hour = new Date(now).getUTCHours(); if (hour < 7 || hour >= 19) return 0;   // 09:00–21:00 in Kyiv: no night messages
  const t = world.tables, players = t.players || [], marks = (t.ae_remind ||= []), out = (t.telegram_outbox ||= []), ev = (t.ae_events ||= []);
  const today = iso(now).slice(0, 10), yesterday = iso(now - DAY).slice(0, 10);
  const marked = (u, k) => marks.some(m => m.u === u && m.k === k), mark = (u, k) => marks.push({u, k, at: iso(now)});
  const player = id => players.find(p => same(p.telegram_id, id));
  let sent = 0;
  const send = (tg, heroId, icon, text, kind) => {
    out.push({id: crypto.randomUUID(), method: 'sendMessage', created_at: iso(now), attempts: 0, completed_at: null, delivery_lease_owner: null, delivery_lease_until: null,
      payload: {chat_id: Number(tg), text: text + OFF_HINT, reply_markup: {inline_keyboard: [[{text: '🎮 Открыть игру', web_app: {url: APP}}]]}}});
    if (heroId) ev.push({id: crypto.randomUUID(), to: String(heroId), icon, text, kind, data: null, at: iso(now), acked: false});
    sent++;
  };
  for (const main of players) {
    if (isAlt(main.telegram_id) || !main.bot_started || main.notification_settings?.enabled !== true) continue;
    const tg = String(main.telegram_id), heroes = accountIds(tg).map(player).filter(p => p?.character_name);
    // 1) opened the game, never created a hero
    if (!heroes.length) {
      const age = now - (Date.parse(main.created_at || 0) || now);
      if (age > 2 * 3600e3 && age < 14 * DAY && !marked(tg, 'nohero')) { mark(tg, 'nohero');
        send(tg, null, '⚔️', '⚔️ Вы заглянули в Аэтельгард, но ещё не создали героя.\n\nЭто займёт минуту: введите имя, выберите класс — и в бой! Новичков ждёт «Путь новичка»: 7 простых шагов с наградами, а за последний — 👑 Premium на сутки.', 'remind'); }
      continue;
    }
    const lead = heroes.reduce((a, b) => seenOf(b) > seenOf(a) ? b : a), seen = Math.max(...heroes.map(seenOf)), name = String(lead.character_name);
    // 2) the daily reward streak would break today
    const daily = (t.ae_daily || []).find(r => same(r.u, tg));
    if (daily?.day === yesterday && hour >= 15 && !marked(tg, 'daily:' + today)) { mark(tg, 'daily:' + today);
      const n = daily.n % 7 + 1;
      send(tg, lead.telegram_id, '🎁', `🎁 ${name}, награда за вход — день ${n} — ждёт вас!\n\nЗаберите её сегодня, иначе серия начнётся с первого дня.${n === 7 ? ' Сегодня — 👑 Premium на сутки!' : ''}`, 'remind'); }
    // 3) away for 3 days (a gift in the mail, at most once in 14 days) and for 7 days
    if (!seen) continue;
    const away = (now - seen) / DAY, since = iso(seen).slice(0, 16);
    if (away >= 3 && away < 30 && !marked(tg, 'back3:' + since)) { mark(tg, 'back3:' + since); if (away >= 7) mark(tg, 'back7:' + since);   // one message, not two in a row
      const giftOk = !marks.some(m => m.u === tg && m.k.startsWith('gift:') && Date.parse(m.at) > now - 14 * DAY) && player(tg)?.character_name;
      let giftText = '';
      if (giftOk) {
        const L = Math.max(1, Math.min(120, Number(player(tg).level) || 1)), gold = Math.round((200 + L * 20) / 10) * 10;
        (t.ae_mail ||= []).push({id: crypto.randomUUID(), op: 'comeback-' + tg + '-' + since, to: tg, title: '🎁 Подарок к возвращению', text: 'Мы скучали! Заберите подарок и загляните в «Награду за вход» — каждый день там новая награда.', gifts: {gold, energy: 50}, at: iso(now)});
        mark(tg, 'gift:' + since); giftText = `\n\n🎁 В почте вас ждёт подарок: ${gold.toLocaleString('ru-RU')} 🪙 и 50 ⚡ (🔔 → «Почта»).`;
      }
      send(tg, lead.telegram_id, '⚔️', `⚔️ ${name}, ваш герой скучает! Вы не заходили ${Math.floor(away)} дн.${giftText}\n\nА ещё в игре теперь есть награда за вход каждый день: на 7-й день — Premium на сутки.`, 'remind');
    } else if (away >= 7 && away < 30 && !marked(tg, 'back7:' + since)) { mark(tg, 'back7:' + since);
      send(tg, lead.telegram_id, '⚔️', `⚔️ ${name}, королевство ждёт вас уже неделю! Загляните хотя бы на минуту: заберите награду за вход и посмотрите, что нового в «Что нового».`, 'remind');
    }
  }
  t.ae_remind = marks.filter(m => Date.parse(m.at) > now - 40 * DAY);
  return sent;
}
