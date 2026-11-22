// Housekeeping for the single world document: keeps it small so every request stays cheap.
import {compactQuestLog} from './arenaExtras.js';
import {isAlt} from './alts.js';
import {pruneFort} from './clanFort.js';
const DAY = 864e5;
const at = row => Date.parse(row?.created_at || row?.updated_at || '') || 0;
const keepRecent = (rows, cutoff) => (rows || []).filter(row => { const t = at(row); return !t || t >= cutoff; });

// Premium is about to run out: a reminder 3 days and 1 day before (in the bot chat and in the 🔔 history), once per stage.
const APP = 'https://app8958621621.tgcloud.ai/';
export function premiumNotices(world, now = Date.now()) {
  const t = world.tables || {}, marks = (t.ae_prem_notice ||= []), out = (t.telegram_outbox ||= []), ev = (t.ae_events ||= []);
  for (const p of t.players || []) {
    if (isAlt(p.telegram_id)) continue;   // Premium is shared by the account's heroes: remind once, from hero 1
    const until = Date.parse(p.premium_until || 0); if (!until || until <= now) continue;
    const left = until - now, stage = left <= DAY ? 1 : left <= 3 * DAY ? 3 : 0; if (!stage) continue;
    const id = String(p.telegram_id), mk = marks.find(m => m.u === id && m.until === p.premium_until);
    if (mk && mk.stage <= stage) continue;
    if (mk) mk.stage = stage; else marks.push({u: id, until: p.premium_until, stage});
    const days = Math.max(1, Math.ceil(left / DAY)), date = new Date(until).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
    const text = stage === 1 ? `👑 Ваш Premium заканчивается завтра (${date}). Продлите его, чтобы не потерять автобой, офлайн-добычу и другие возможности: Меню → Premium.`
      : `👑 Ваш Premium закончится через ${days} дн. (${date}). Продлить можно в игре: Меню → Premium.`;
    ev.push({id: crypto.randomUUID(), to: id, icon: '👑', text, kind: 'premium', data: null, at: new Date(now).toISOString(), acked: false});
    if (p.bot_started && p.notification_settings?.enabled !== false) out.push({id: crypto.randomUUID(), method: 'sendMessage', created_at: new Date(now).toISOString(), attempts: 0, completed_at: null, delivery_lease_owner: null, delivery_lease_until: null,
      payload: {chat_id: Number(id), text, reply_markup: {inline_keyboard: [[{text: '🎮 Открыть игру', web_app: {url: APP}}]]}}});
  }
  t.ae_prem_notice = marks.filter(m => Date.parse(m.until) > now - 7 * DAY);
}
export function pruneWorld(world, now = Date.now()) {
  try { premiumNotices(world, now); } catch {}
  const t = world.tables || {}, before = JSON.stringify(t).length;
  // Idempotency receipts only matter for client retries within minutes.
  if (t.game_operations) t.game_operations = keepRecent(t.game_operations, now - 7 * DAY);
  if (t.progress_api_operations) t.progress_api_operations = keepRecent(t.progress_api_operations, now - 7 * DAY);
  if (t.inventory_bulk_disposals) t.inventory_bulk_disposals = keepRecent(t.inventory_bulk_disposals, now - 7 * DAY);
  // Analytics: kept for 14 days (the single world document has a size limit).
  for (const name of ['balance_battles', 'balance_sessions', 'balance_progress']) if (t[name]) t[name] = keepRecent(t[name], now - 14 * DAY);
  // Delivered notifications and outbox rows.
  if (t.game_notifications) t.game_notifications = t.game_notifications.filter(n => !n.sent_at || Date.parse(n.sent_at) >= now - 30 * DAY);
  if (t.telegram_outbox) t.telegram_outbox = t.telegram_outbox.filter(o => !o.completed_at || Date.parse(o.completed_at) >= now - 7 * DAY);
  // Add-on tables: each cleans itself when used, this is the safety net for the ones nobody opens any more.
  const old = (name, days, key = 'at') => { if (t[name]) t[name] = t[name].filter(r => { const x = Date.parse(r?.[key] || ''); return !x || x >= now - days * DAY; }); };
  old('ae_clan_raid_runs', 2); old('ae_clan_raid_setups', 2); old('ae_clan_requests', 8); old('ae_clan_invites', 8); old('ae_deposits', 3); compactQuestLog(world, now); old('ae_clan_goals', 15);
  old('ae_clan_welcomed', 30); old('ae_clan_hunt_runs', 2); pruneFort(world, now); old('ae_bug_reports', 30); old('ae_gem_ops', 3); old('ae_client_diag', 3);
  if (t.ae_events) t.ae_events = t.ae_events.filter(e => Date.parse(e.at) > now - (e.acked ? 7 : 14) * DAY).slice(-800);
  for (const name of ['ae_clan_daily', 'ae_clan_chest']) if (t[name]) { const min = new Date(now - 2 * DAY).toISOString().slice(0, 10); t[name] = t[name].filter(r => String(r.day) >= min); }
  if (t.clan_storage_events) t.clan_storage_events = t.clan_storage_events.slice(-400);
  if (t.clan_chat_messages) { const per = new Map(); t.clan_chat_messages = t.clan_chat_messages.slice().reverse().filter(m => { const n = (per.get(m.clan_id) || 0) + 1; per.set(m.clan_id, n); return n <= 200; }).reverse(); }
  return {before, after: JSON.stringify(t).length};
}

// Server-side sanity limits for values the local-save client reports.
export function clampProfileSync(world, userId, body, now = Date.now()) {
  if (!body || typeof body !== 'object') return body;
  const row = (world.tables?.players || []).find(p => String(p.telegram_id) === String(userId));
  const next = {...body};
  const prevLevel = Math.max(1, Number(row?.level) || 1);
  const prevRating = Number.isFinite(Number(row?.arena_rating)) ? Number(row.arena_rating) : 1000;
  const hours = Math.max(0, (now - (Date.parse(row?.updated_at || '') || now)) / 3600e3);
  if (Number.isFinite(Number(next.level))) next.level = Math.max(1, Math.min(Math.floor(Number(next.level)), prevLevel + 5 + Math.floor(hours * 6), 120));
  if (Number.isFinite(Number(next.arenaRating))) next.arenaRating = Math.max(0, Math.min(Math.floor(Number(next.arenaRating)), prevRating + 500 + Math.floor(hours * 200), 10000));
  return next;
}

// Characters migrated to the server-actions model in October still play with the local-save client.
// The engine ignores their profile sync, so their public level/rating froze; apply it here.
export function syncCanonicalProfile(world, userId, body, now = Date.now()) {
  const row = (world.tables?.players || []).find(p => String(p.telegram_id) === String(userId));
  if (!row || row.character_authority !== 'server-actions-v1' || !body) return null;
  const b = clampProfileSync(world, userId, body, now);
  if (Number.isFinite(Number(b.level))) row.level = Number(b.level);
  if (Number.isFinite(Number(b.arenaRating))) row.arena_rating = Number(b.arenaRating);
  if (typeof b.characterName === 'string' && b.characterName.trim()) row.character_name = b.characterName.trim().slice(0, 32);
  if (typeof b.classId === 'string' && /^[a-z_]{2,20}$/.test(b.classId)) row.class_id = b.classId;
  row.updated_at = new Date(now).toISOString();
  return {status: 200, body: {ok: true}};
}
