// Live features: pet satiety (server-kept, bot reminder), Blood Moon weekend announcement,
// invite-a-friend (on top of the engine's referral reward) and admin analytics.
import {bloodWeekend} from './horde.js';
import {saveStats} from './heroStats.js';
import {encodeDocument, STORAGE_CELL_LIMIT} from './storageCodec.js';
import {handleClanPlus, clanTick} from './clanPlus.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const DAY = 864e5;

// ---------- scheduled bot notifications (delivered by the engine's outbox worker) ----------
function schedule(world, to, key, category, text, dueAt, now) {
  const list = rows(world, 'game_notifications');
  if (list.some(n => same(n.telegram_id, to) && n.event_key === key)) return;
  const id = list.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0) + 1;
  list.push({id, telegram_id: Number(to), event_key: key, category, text, due_at: iso(dueAt), sent_at: null, read_at: null, attempts: 0,
    next_attempt_at: iso(now), created_at: iso(now), updated_at: iso(now)});
}
const unschedule = (world, to, category) => { world.tables.game_notifications = rows(world, 'game_notifications').filter(n => !(same(n.telegram_id, to) && n.category === category && !n.sent_at)); };

// ---------- pet satiety: 100 → 0 over a day, hungry below 25 ----------
const HUNGRY = 25, FEED = {food: 40, bowl: 50, feast: 100, fish_common: 30, fish_uncommon: 45, fish_rare: 70, fish_epic: 85, fish_legendary: 100};
const FOOD_NAME = /мясо|рыб|окун|карп|карас|щук|форел|лещ|сом\b|судак|угор|голец|хариус|ос[её]тр|кои\b|линь/i;
const satOf = (r, now) => Math.max(0, Math.min(100, r.v - (now - r.t) * 100 / DAY));
// ---------- pet levels: XP from fights (capped per day) and from feeding; stats grow 6% per level, up to 30 ----------
export const PET_MAX = 30;
export const petNeed = lvl => 60 + lvl * 30;
const FEED_XP = {food: 10, bowl: 12, feast: 25, fish_common: 8, fish_uncommon: 15, fish_rare: 30, fish_epic: 45, fish_legendary: 60};
const FIGHT_XP_DAY = 600;
const petId = v => /^pet_[a-z_]{2,30}$/.test(String(v || '')) ? String(v) : null;
function petProg(r, id) { r.pets ||= {}; return id ? (r.pets[id] ||= {lvl: 1, xp: 0}) : null; }
function petGain(r, id, xp) {
  const g = petProg(r, id); if (!g || !(xp > 0)) return 0;
  const from = g.lvl; g.xp += Math.round(xp);
  while (g.lvl < PET_MAX && g.xp >= petNeed(g.lvl)) { g.xp -= petNeed(g.lvl); g.lvl++; }
  if (g.lvl >= PET_MAX) g.xp = 0;
  return g.lvl - from;
}
function petView(r, now, id) {
  const sat = satOf(r, now), g = id ? petProg(r, id) : null;
  return {sat: Math.round(sat * 10) / 10, hungry: sat < HUNGRY, at: now, pet: g ? {id, level: g.lvl, xp: g.xp, need: g.lvl >= PET_MAX ? 0 : petNeed(g.lvl), max: PET_MAX} : null,
    pets: Object.fromEntries(Object.entries(r.pets || {}).map(([k, v]) => [k, v.lvl]))};
}
function petRemind(world, me, r, now) {
  unschedule(world, me, 'pets');
  const sat = satOf(r, now), due = sat > HUNGRY ? now + (sat - HUNGRY) * DAY / 100 : now;
  schedule(world, me, 'pet_' + Math.round(due / 60e3), 'pets', '🐾 Ваш питомец проголодался! Голодный питомец даёт только половину характеристик — загляните в Приют и покормите его.', due, now);
}
function handlePet(world, body, me, now) {
  const list = rows(world, 'ae_pet_food');
  let r = list.find(x => same(x.user, me));
  if (!r) { // first contact: adopt the value the device kept until now
    const l = body.local, v = l && Number.isFinite(+l.v) && Number.isFinite(+l.t) && +l.t <= now ? satOf({v: Math.min(100, +l.v), t: +l.t}, now) : 100;
    r = {user: me, v, t: now}; list.push(r); petRemind(world, me, r, now);
  }
  if (body.action === 'feed') {
    const add = FEED[body.how]; if (!add) return fail('Неизвестный корм.');
    const sat = satOf(r, now); if (sat >= 99) return fail('Питомец сыт и не хочет есть.');
    if (body.itemId) { // a server-held catch or meat: take one from the hero's server bag
      const it = rows(world, 'owned_items').find(i => i.id === body.itemId && same(i.owner_telegram_id, me));
      const fish = it && String(it.item_json?.templateId || '').startsWith('fish_');
      if (!it || it.locked || it.equipped_slot || !(fish || FOOD_NAME.test(it.item_json?.name || ''))) return fail('Этим питомца не накормить.');
      if (String(body.how).startsWith('fish_') && (!fish || 'fish_' + (it.item_json.rarity || 'common') !== body.how)) return fail('Этим питомца не накормить.');
      if (Number(it.quantity) > 1) { it.quantity = Number(it.quantity) - 1; it.updated_at = iso(now); } else world.tables.owned_items = rows(world, 'owned_items').filter(i => i !== it);
    }
    r.v = Math.min(100, sat + add); r.t = now; petRemind(world, me, r, now);
    r.up = petGain(r, petId(body.pet), FEED_XP[body.how] || 0);
  } else r.up = 0;
  if (body.action === 'xp' && petId(body.pet)) { // fights: 2 XP per monster, 15 per boss, at most 600 a day
    const day = iso(now).slice(0, 10); if (r.xpDay !== day) { r.xpDay = day; r.xpToday = 0; }
    const want = Math.max(0, Math.min(50, Math.floor(Number(body.kills) || 0))) * 2 + Math.max(0, Math.min(10, Math.floor(Number(body.bosses) || 0))) * 15;
    const got = Math.min(want, FIGHT_XP_DAY - r.xpToday); r.xpToday += got; r.up = petGain(r, petId(body.pet), got);
  }
  const view = petView(r, now, petId(body.pet)); view.up = r.up || 0; delete r.up;
  return ok(view);
}

// ---------- Blood Moon weekend: one bot announcement per weekend to recently active players ----------
function weekendAnnounce(world, now) {
  const w = bloodWeekend(now); if (!w.on) return;
  const flags = rows(world, 'ae_flags'), key = 'bm_weekend_' + w.key;
  if (flags.some(f => f.key === key)) return;
  flags.push({key, at: iso(now)});
  const active = rows(world, 'players').filter(p => p.bot_started && Date.parse(p.last_seen_at || 0) > now - 14 * DAY).slice(0, 2000);
  for (const p of active) schedule(world, p.telegram_id, key, 'announcements',
    '🌕 Выходные Кровавой луны! До конца воскресенья каждый поход в Орду — Кровавая луна с двойной наградой. Лунные чудовища уже у ворот!', now, now);
}

// ---------- invite a friend: the engine grants 3 days of Premium to both when the friend reaches level 10 ----------
const REF_LEVEL = 10;
function refJoinNotice(world, me, now, notify) {
  const p = player(world, me); if (!p?.referred_by) return;
  const flags = rows(world, 'ae_flags'), key = 'ref_joined_' + me;
  if (flags.some(f => f.key === key)) return;
  flags.push({key, at: iso(now)});
  notify?.(world, p.referred_by, `🎉 ${nameOf(p)} пришёл в Аэтельгард по вашей ссылке! Когда герой друга достигнет ${REF_LEVEL} уровня, вы оба получите Premium на 3 дня.`, 'ref-join:' + me, now);
}
async function handleReferrals(world, me, native) {
  const r = await native({path: '/api/referrals', method: 'GET'});
  if (!r || r.status >= 400) return fail(r?.body?.error || 'Не удалось получить ссылку.');
  const rewarded = new Set(rows(world, 'referral_rewards').filter(x => same(x.inviter, me)).map(x => String(x.invitee)));
  const invited = rows(world, 'players').filter(p => same(p.referred_by, me))
    .map(p => ({name: nameOf(p), level: Number(p.level) || 1, classId: p.class_id || null, rewarded: rewarded.has(String(p.telegram_id)), joined: p.created_at}))
    .sort((a, b) => Number(a.rewarded) - Number(b.rewarded) || b.level - a.level).slice(0, 50);
  return ok({url: r.body.url, rewardDays: r.body.rewardDays || 3, requiredLevel: r.body.requiredLevel || REF_LEVEL, count: rewarded.size, invited});
}

// ---------- clan invites: personal (friends) and public (a code posted to the global chat) ----------
const clanOfPlayer = (world, id) => { const m = rows(world, 'clan_members').find(x => same(x.telegram_id, id)); return m ? {m, clan: rows(world, 'clans').find(c => same(c.id, m.clan_id))} : {}; };
const clanCard = (world, clan) => clan && ({id: clan.id, name: clan.name, tag: clan.tag, level: Number(clan.level) || 1, members: rows(world, 'clan_members').filter(x => same(x.clan_id, clan.id)).length, max: Number(clan.max_members) || 30, minLevel: Number(clan.min_join_level) || 1});
const newCode = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
function handleClanInvites(world, path, method, body, me, now, notify) {
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  const list = rows(world, 'ae_clan_invites');
  world.tables.ae_clan_invites = list.filter(x => Date.parse(x.expires) > now);
  const {m, clan} = clanOfPlayer(world, me);
  if (method === 'GET' && path === '/api/ae-clan') return ok({clan: clanCard(world, clan), role: m?.role || null});
  if (path === '/api/ae-clan/invite') {
    if (!clan) return fail('Сначала вступите в клан.');
    const friend = String(body.friendId || ''), fp = player(world, friend);
    const linked = rows(world, 'friendships').some(f => f.status === 'accepted' && ((same(f.a, me) && same(f.b, friend)) || (same(f.b, me) && same(f.a, friend))));
    if (!fp || !linked) return fail('Приглашать можно только друзей.');
    if (clanOfPlayer(world, friend).clan) return fail('Друг уже состоит в клане.');
    const sent = rows(world, 'ae_clan_invites').filter(x => same(x.by, me) && Date.parse(x.at) > now - DAY).length; if (sent >= 30) return fail('Сегодня отправлено слишком много приглашений.');
    const inv = {code: newCode(), clan: clan.id, by: String(me), to: friend, uses: 1, at: iso(now), expires: iso(now + 7 * DAY)};
    rows(world, 'ae_clan_invites').push(inv);
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: friend, icon: '🛡️', text: `${nameOf(p)} зовёт вас в клан [${clan.tag}] «${clan.name}»`, kind: 'clan-invite', data: {code: inv.code, clan: clanCard(world, clan)}, at: iso(now), acked: false});
    notify?.(world, friend, `🛡️ ${nameOf(p)} зовёт вас в клан [${clan.tag}] «${clan.name}». Откройте игру, чтобы вступить.`, 'clan-invite:' + me, now);
    return ok({invited: true});
  }
  if (path === '/api/ae-clan/share') {
    if (!clan) return fail('Сначала вступите в клан.');
    const inv = {code: newCode(), clan: clan.id, by: String(me), to: null, uses: 15, at: iso(now), expires: iso(now + DAY)};
    rows(world, 'ae_clan_invites').push(inv);
    return ok({code: inv.code, clan: clanCard(world, clan)});
  }
  if (path === '/api/ae-clan/join') {
    const inv = rows(world, 'ae_clan_invites').find(x => x.code === String(body.code || ''));
    if (!inv || inv.uses <= 0) return fail('Приглашение устарело.');
    if (inv.to && !same(inv.to, me)) return fail('Это приглашение для другого игрока.');
    if (clan) return fail('Вы уже состоите в клане.');
    const target = rows(world, 'clans').find(c => same(c.id, inv.clan)); if (!target) return fail('Клан не найден.');
    if ((Number(p.level) || 1) < (Number(target.min_join_level) || 1)) return fail(`Нужен ${target.min_join_level} уровень.`);
    if (rows(world, 'clan_members').filter(x => same(x.clan_id, target.id)).length >= (Number(target.max_members) || 30)) return fail('Клан заполнен.');
    rows(world, 'clan_members').push({clan_id: target.id, telegram_id: Number(me), role: 'recruit', joined_at: iso(now), raid_damage: 0, last_raid_attack: null});
    p.clan_id = target.id; p.updated_at = iso(now); inv.uses--;
    notify?.(world, inv.by, `🛡️ ${nameOf(p)} вступил(а) в клан «${target.name}» по вашему приглашению!`, 'clan-joined:' + me, now);
    return ok({joined: true, clan: clanCard(world, target)});
  }
  return fail('API не найден.', 404);
}

// ---------- analytics: section visits from the client + admin report ----------
const dayKey = t => iso(t).slice(0, 10);
function track(world, me, sections, now) {
  const day = dayKey(now), list = rows(world, 'ae_visits');
  for (const s0 of (Array.isArray(sections) ? sections : []).slice(0, 30)) {
    const s = String(s0 || '').trim().slice(0, 40); if (!s) continue;
    let r = list.find(x => x.day === day && x.s === s);
    if (!r) { r = {day, s, n: 0, u: []}; list.push(r); }
    r.n++; if (r.u.length < 5000 && !r.u.includes(String(me))) r.u.push(String(me));
  }
  world.tables.ae_visits = list.filter(x => x.day >= dayKey(now - 35 * DAY));
  return ok({ok: true});
}
function report(world, now) {
  const days = [...Array(14)].map((_, i) => dayKey(now - (13 - i) * DAY));
  const act = rows(world, 'balance_activity'), players = rows(world, 'players');
  const byDay = new Map(); for (const a of act) { if (!byDay.has(a.day)) byDay.set(a.day, new Set()); byDay.get(a.day).add(String(a.telegram_id)); }
  const created = new Map(players.map(p => [String(p.telegram_id), dayKey(Date.parse(p.created_at || 0) || 0)]));
  const newBy = d => players.filter(p => created.get(String(p.telegram_id)) === d).map(p => String(p.telegram_id));
  const shift = (d, n) => dayKey(Date.parse(d + 'T00:00:00Z') + n * DAY);
  const ret = (cohortDays, n) => { let base = 0, back = 0; for (const d of cohortDays) { const t = shift(d, n); if (t > dayKey(now)) continue; const c = newBy(d); base += c.length; const s = byDay.get(t); if (s) back += c.filter(id => s.has(id)).length; } return base ? {pct: Math.round(back * 100 / base), base} : {pct: null, base: 0}; };
  const lastDays = [...Array(30)].map((_, i) => dayKey(now - (i + 1) * DAY));
  const daily = days.map(d => ({day: d, dau: byDay.get(d)?.size || 0, new: newBy(d).length}));
  const visits = rows(world, 'ae_visits').filter(v => v.day >= dayKey(now - 6 * DAY));
  const sec = new Map(); for (const v of visits) { const r = sec.get(v.s) || {s: v.s, n: 0, u: new Set()}; r.n += v.n; v.u.forEach(x => r.u.add(x)); sec.set(v.s, r); }
  const sections = [...sec.values()].map(r => ({s: r.s, n: r.n, users: r.u.size})).sort((a, b) => b.users - a.users).slice(0, 25);
  // Where do players stop: last screen of players who have not been back for 3+ days (seen in the last 30).
  const sess = rows(world, 'balance_sessions'), lastSess = new Map();
  for (const s of sess) { const k = String(s.telegram_id), o = lastSess.get(k); if (!o || String(s.updated_at) > String(o.updated_at)) lastSess.set(k, s); }
  const quit = new Map(); let quitN = 0;
  for (const p of players) { const seen = Date.parse(p.last_seen_at || 0); if (!(seen < now - 3 * DAY && seen > now - 30 * DAY)) continue; quitN++;
    const s = lastSess.get(String(p.telegram_id)), key = `${s?.last_screen || '—'} · ур. ${Math.min(Number(p.level) || 1, 99) <= 5 ? '1–5' : Number(p.level) <= 15 ? '6–15' : '16+'}`; quit.set(key, (quit.get(key) || 0) + 1); }
  const quitList = [...quit.entries()].map(([k, n]) => ({k, n})).sort((a, b) => b.n - a.n).slice(0, 12);
  const total = players.length, wau = new Set(act.filter(a => a.day > dayKey(now - 7 * DAY)).map(a => String(a.telegram_id))).size;
  const mau = new Set(act.filter(a => a.day > dayKey(now - 30 * DAY)).map(a => String(a.telegram_id))).size;
  return ok({total, dau: byDay.get(dayKey(now))?.size || 0, wau, mau, daily, retention: {d1: ret(lastDays, 1), d3: ret(lastDays, 3), d7: ret(lastDays, 7)}, sections, quit: {n: quitN, list: quitList},
    storage: storageInfo(world), botUsers: players.filter(p => p.bot_started).length, notifyOn: players.filter(p => p.bot_started && p.notification_settings?.enabled === true).length});
}

// How full the single world document is (its stored form must stay under the storage cell limit).
function storageInfo(world) {
  const raw = JSON.stringify(world); let stored = raw.length;
  try { stored = encodeDocument(raw).length; } catch { stored = STORAGE_CELL_LIMIT; }
  const tables = Object.entries(world.tables || {}).map(([k, v]) => ({k, n: Array.isArray(v) ? v.length : 0, kb: Math.round(JSON.stringify(v).length / 1024)})).sort((a, b) => b.kb - a.kb).slice(0, 8);
  return {rawKb: Math.round(raw.length / 1024), storedKb: Math.round(stored / 1024), limitKb: Math.round(STORAGE_CELL_LIMIT / 1024), pct: Math.round(100 * stored / STORAGE_CELL_LIMIT), tables};
}
// ---------- clan succession: a leader away for 3+ days hands the clan to the highest-level active member ----------
const seenAt = p => Date.parse(p?.last_seen_at || p?.updated_at || 0) || 0;
export function clanSuccession(world, now, notify) {
  const moved = [];
  for (const clan of rows(world, 'clans')) {
    const ownerId = clan.owner_telegram_id, owner = player(world, ownerId);
    if (owner && seenAt(owner) >= now - 3 * DAY) continue;
    const members = rows(world, 'clan_members').filter(m => same(m.clan_id, clan.id) && !same(m.telegram_id, ownerId));
    const heir = members.map(m => ({m, p: player(world, m.telegram_id)})).filter(x => x.p && seenAt(x.p) >= now - 3 * DAY)
      .sort((a, b) => (Number(b.p.level) || 1) - (Number(a.p.level) || 1) || (Number(b.p.arena_rating) || 0) - (Number(a.p.arena_rating) || 0) || seenAt(b.p) - seenAt(a.p))[0];
    if (!heir) continue;
    const old = rows(world, 'clan_members').find(m => same(m.clan_id, clan.id) && same(m.telegram_id, ownerId));
    if (old) old.role = 'officer';
    heir.m.role = 'owner'; clan.owner_telegram_id = heir.m.telegram_id; clan.updated_at = iso(now);
    const tag = `[${clan.tag}] «${clan.name}»`;
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(heir.m.telegram_id), icon: '👑', text: `Глава клана ${tag} не заходил 3 дня — теперь вы глава клана!`, kind: 'clan-leader', at: iso(now), acked: false});
    notify?.(world, heir.m.telegram_id, `👑 Глава клана ${tag} не заходил 3 дня. Лидерство перешло к вам как к самому сильному активному участнику!`, 'clan-leader:' + clan.id + ':' + heir.m.telegram_id, now);
    if (owner) notify?.(world, ownerId, `🛡️ Вы не заходили 3 дня, и лидерство в клане ${tag} перешло к ${nameOf(heir.p)}. Вы остались офицером.`, 'clan-leader-lost:' + clan.id + ':' + ownerId, now);
    moved.push({clan: clan.id, from: String(ownerId), to: String(heir.m.telegram_id)});
  }
  return moved;
}

let lastClanSweep = 0;
export async function handleLiveRequest(world, input, user, now, native, notify) {
  try { weekendAnnounce(world, now); refJoinNotice(world, String(user.id), now, notify); } catch (e) { console.warn('live prelude', e?.message); }
  // Whole-world clan sweeps (leader succession) run at most once per 5 minutes per isolate; the cheap per-player part runs always.
  try { if (now - lastClanSweep > 300e3 || now < lastClanSweep) { lastClanSweep = now; clanSuccession(world, now, notify); } clanTick(world, String(user.id), now, notify); } catch (e) { console.warn('clan succession', e?.message); }
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-pet') && !path.startsWith('/api/ae-clan') && path !== '/api/ae-referrals' && path !== '/api/ae-stats' && path !== '/api/ae-track' && path !== '/api/ae-admin/stats') return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  if (path === '/api/ae-pet') { if (!player(world, me)) return fail('Сначала создайте персонажа.', 404); return handlePet(world, body, me, now); }
  if (path.startsWith('/api/ae-clanx')) return handleClanPlus(world, path, method, body, me, now, native, notify);
  if (path.startsWith('/api/ae-clan')) return handleClanInvites(world, path, method, body, me, now, notify);
  if (path === '/api/ae-referrals') { if (!player(world, me)) return fail('Сначала создайте персонажа.', 404); return handleReferrals(world, me, native); }
  if (path === '/api/ae-stats') { const r = saveStats(world, me, body.stats, now); return r ? ok({ok: true}) : fail('Нет данных.'); }
  if (path === '/api/ae-track') return track(world, me, body.s, now);
  if (path === '/api/ae-admin/stats') { if (!user.isAdmin) return fail('Недостаточно прав.', 403); return report(world, now); }
  return null;
}
