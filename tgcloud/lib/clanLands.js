// Clan lands: fortresses around the kingdom that clans capture together, defend with hired squads and a governor
// (one of a member's companions), and develop for passive income (gold, a mine, or a bastion).
// Settled lazily (no scheduler): defence regenerates and income flows into the owner clan's treasury hour by hour.
import {clanOf, membersOf, metaOf, tellClan, addClanXp, clanCredit, fortOf, todayStart} from './clanPlus.js';
import {GUARDS} from './clanFort.js';
import {baseStats, realStats} from './heroStats.js';
import {compStats, compImg} from './companions.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const HOUR = 36e5;
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const SPENDERS = ['owner', 'officer', 'quartermaster'], LEADERS = ['owner', 'officer'];

export const TIERS = [null,
  {name: 'Застава', def: 3000, income: 60, cap: 30, wall: 0.3},
  {name: 'Форт', def: 12000, income: 120, cap: 60, wall: 0.35},
  {name: 'Замок', def: 30000, income: 220, cap: 100, wall: 0.4},
  {name: 'Твердыня', def: 70000, income: 400, cap: 150, wall: 0.45}];
export const LANDS = [
  {id: 'l_plains', name: 'Застава у Пастбищ', tier: 1, region: 'reg_plains'},
  {id: 'l_forest', name: 'Лесной кордон', tier: 1, region: 'reg_forest'},
  {id: 'l_swamp', name: 'Топкий острог', tier: 1, region: 'reg_swamp'},
  {id: 'l_whisper', name: 'Шепчущая сторожка', tier: 1, region: 'reg_whisper_woods'},
  {id: 'l_desert', name: 'Песчаный форт', tier: 2, region: 'reg_desert'},
  {id: 'l_crypt', name: 'Форт у Склепа', tier: 2, region: 'reg_forgotten_crypt'},
  {id: 'l_cursed', name: 'Проклятый бастион', tier: 2, region: 'reg_cursed'},
  {id: 'l_rift', name: 'Замок Разлома', tier: 3, region: 'reg_rift'},
  {id: 'l_ash', name: 'Пепельный замок', tier: 3, region: 'reg_cursed'},
  {id: 'l_dragon', name: 'Драконья Твердыня', tier: 4, region: 'reg_dragon'},
];
// What the land is built for: income kind and the bonus per level (up to 5).
export const SPECS = {
  gold: {name: 'Монетный двор', icon: '💰', desc: 'Золото в казну: +25% за уровень.'},
  mine: {name: 'Рудник', icon: '⛏️', desc: 'Серебро и руда в казну вместо золота: +25% за уровень.'},
  bastion: {name: 'Бастион', icon: '🛡️', desc: 'Оборона земли +20% за уровень и немного золота.'},
};
const SPEC_MAX = 5;
export const specCost = (tier, lvl) => Math.round(2000 * tier * Math.pow(1.8, lvl - 1) / 100) * 100;
const SHIELD = 6 * HOUR, HITS_PER_DAY = 3, REGEN = 0.02;

const landsOf = world => rows(world, 'ae_lands');
function landRow(world, L) {
  let r = landsOf(world).find(x => x.id === L.id);
  if (!r) { r = {id: L.id, owner: null, troops: {}, gov: null, spec: null, specLvl: 0, pool: null, at: null, inc_at: null, shield: null, log: []}; landsOf(world).push(r); }
  return r;
}
const llog = (r, now, icon, text) => { r.log.push({at: iso(now), icon, text}); if (r.log.length > 8) r.log = r.log.slice(-8); };
const clanById = (world, id) => rows(world, 'clans').find(c => same(c.id, id)) || null;
const lv = (f, k) => Number(f?.b?.[k]?.lvl) || 0;
const heroPw = (world, id) => { const p = player(world, id); if (!p) return 0; const s = realStats(world, id, p) || baseStats(p); return Math.round((s.atk || 0) + (s.def || 0) + (s.maxHp || 0) / 10); };
const govPw = c => { const s = compStats(c); return Math.round((s.atk + s.def) * 4 + s.maxHp / 4); };
export const limitOf = clan => Math.min(5, 1 + Math.floor((Number(clan?.level) || 1) / 3));

// Defence of a land: the walls (a share of the tier's base), the squads and the governor; neutral lands keep the full base.
export function maxDef(world, L, r) {
  const T = TIERS[L.tier];
  if (!r.owner) return T.def;
  const troops = GUARDS.reduce((s, g) => s + (r.troops[g.k] || 0) * g.pw, 0), gov = r.gov?.pw || 0;
  const mul = (1 + (r.spec === 'bastion' ? 0.2 * r.specLvl : 0)) * (r.gov ? 1.1 : 1);
  return Math.round((T.def * T.wall + troops + gov) * mul);
}
export function incomeOf(L, r) {
  const T = TIERS[L.tier], up = 1 + 0.25 * (r.specLvl || 0), gov = r.gov ? 1.1 : 1;
  if (!r.owner) return {gold: 0, silver: 0, ore: 0};
  if (r.spec === 'gold') return {gold: Math.round(T.income * up * gov), silver: 0, ore: 0};
  if (r.spec === 'mine') return {gold: 0, silver: Math.round(T.income * 0.6 * up * gov), ore: Math.round(T.income / 20 * up * gov)};
  if (r.spec === 'bastion') return {gold: Math.round(T.income * 0.4 * gov), silver: 0, ore: 0};
  return {gold: Math.round(T.income * 0.5 * gov), silver: 0, ore: 0};
}

// ---------- lazy settlement: regeneration, income, shields ----------
export function landsTick(world, now) {
  for (const L of LANDS) {
    const r = landRow(world, L), max = maxDef(world, L, r);
    if (r.pool == null) { r.pool = max; r.at = iso(now); }
    const h = Math.min(48, (now - (Date.parse(r.at) || now)) / HOUR);
    if (h > 0.05) { r.pool = Math.min(max, Math.round(r.pool + max * REGEN * h)); r.at = iso(now); }
    if (r.pool > max) r.pool = max;
    if (r.owner) {
      const clan = clanById(world, r.owner);
      if (!clan || !membersOf(world, clan).length) { Object.assign(r, {owner: null, troops: {}, gov: null, pool: TIERS[L.tier].def, shield: null}); llog(r, now, '🏳️', 'Клан распался — земля снова ничья.'); continue; }
      const hrs = Math.min(48, Math.floor((now - (Date.parse(r.inc_at) || now)) / HOUR));
      if (hrs > 0) {
        r.inc_at = iso(Date.parse(r.inc_at) + hrs * HOUR); const inc = incomeOf(L, r);
        clan.treasury_gold = (Number(clan.treasury_gold) || 0) + inc.gold * hrs; clan.treasury_silver = (Number(clan.treasury_silver) || 0) + inc.silver * hrs; clan.treasury_ore = (Number(clan.treasury_ore) || 0) + inc.ore * hrs;
        r.earned = (r.earned || 0) + inc.gold * hrs + inc.silver * hrs;
      }
    }
  }
}

function landView(world, L, r, clan, now) {
  const owner = r.owner ? clanById(world, r.owner) : null, mine = !!(clan && owner && same(owner.id, clan.id)), T = TIERS[L.tier];
  const shield = r.shield && Date.parse(r.shield) > now ? r.shield : null, max = maxDef(world, L, r);
  return {id: L.id, name: L.name, tier: L.tier, tierName: T.name, img: `/assets/regions/region-${L.region}.webp`,
    owner: owner ? {id: owner.id, tag: owner.tag, name: owner.name, emblem: metaOf(world, owner).emblem} : null, mine,
    def: Math.max(0, Math.round(r.pool ?? max)), max, shield, troops: GUARDS.map(g => ({k: g.k, n: r.troops[g.k] || 0})), cap: T.cap, count: GUARDS.reduce((s, g) => s + (r.troops[g.k] || 0), 0),
    gov: r.gov ? {name: r.gov.name, img: r.gov.img, lvl: r.gov.lvl, pw: r.gov.pw, ownerName: r.gov.ownerName, mine: false} : null, govU: r.gov?.u || null,
    spec: r.spec, specLvl: r.specLvl || 0, income: incomeOf(L, r), baseIncome: T.income,
    next: r.owner ? (r.specLvl >= SPEC_MAX ? null : specCost(L.tier, (r.specLvl || 0) + 1)) : null, log: mine ? r.log.slice(-5).reverse() : []};
}
function view(world, me, clan, m, now) {
  const f = fortOf(world, clan.id), day = todayStart(now), used = m.land_day === day ? m.land_n || 0 : 0;
  const lands = LANDS.map(L => landView(world, L, landRow(world, L), clan, now));
  const mineL = lands.filter(x => x.mine), inc = mineL.reduce((s, x) => ({gold: s.gold + x.income.gold, silver: s.silver + x.income.silver, ore: s.ore + x.income.ore}), {gold: 0, silver: 0, ore: 0});
  const busy = new Set(landsOf(world).filter(r => r.gov).map(r => String(r.gov.compId)));
  const comps = rows(world, 'ae_companions').filter(c => same(c.u, me)).map(c => ({id: c.id, name: c.name, img: compImg(c), lvl: c.lvl || 1, pw: govPw(c), busy: busy.has(String(c.id))}));
  return {role: m.role, spend: SPENDERS.includes(m.role), lead: LEADERS.includes(m.role), clan: {id: clan.id, tag: clan.tag, level: Number(clan.level) || 1},
    treasury: {gold: Number(clan.treasury_gold) || 0, silver: Number(clan.treasury_silver) || 0, ore: Number(clan.treasury_ore) || 0},
    owned: mineL.length, limit: limitOf(clan), income: inc, hits: {left: Math.max(0, HITS_PER_DAY - used), max: HITS_PER_DAY}, myPw: heroPw(world, me),
    units: GUARDS.map(g => ({k: g.k, name: g.name, icon: g.icon, hire: g.hire, pw: g.pw, need: g.need, open: lv(f, 'barracks') >= g.need})),
    specs: SPECS, specMax: SPEC_MAX, lands, comps, hasCitadel: lv(f, 'hall') >= 1};
}

export function handleLands(world, path, method, body, me, now, notify) {
  const {clan, m} = clanOf(world, me); if (!clan) return fail('Вы не в клане.');
  landsTick(world, now);
  if (path === '/api/ae-clanx/lands' && method === 'GET') return ok(view(world, me, clan, m, now));
  if (method !== 'POST') return fail('API не найден.', 404);
  const L = LANDS.find(x => x.id === body.id); if (!L) return fail('Такой земли нет.', 404);
  const r = landRow(world, L), p = player(world, me), mine = same(r.owner, clan.id), done = extra => ok({...view(world, me, clan, m, now), ...extra});
  const gold = () => Number(clan.treasury_gold) || 0;

  if (path === '/api/ae-clanx/lands/attack') {
    if (mine) return fail('Это уже наша земля.');
    if (r.shield && Date.parse(r.shield) > now) return fail(`Земля под защитой после захвата ещё ${Math.ceil((Date.parse(r.shield) - now) / HOUR)} ч.`);
    const owned = landsOf(world).filter(x => same(x.owner, clan.id)).length;
    if (owned >= limitOf(clan)) return fail(`Клан уже держит ${owned} из ${limitOf(clan)} земель. Лимит растёт с уровнем клана (+1 каждые 3 уровня).`);
    const day = todayStart(now); if (m.land_day !== day) { m.land_day = day; m.land_n = 0; }
    if (m.land_n >= HITS_PER_DAY) return fail('Сегодня вы уже трижды штурмовали. Новые штурмы — в 00:00 UTC.');
    m.land_n++;
    const f = fortOf(world, clan.id), mul = 1 + lv(f, 'forge') * 0.03 + lv(f, 'barracks') * 0.05;
    const max = maxDef(world, L, r), before = Math.max(0, r.pool ?? max);
    const dmg = Math.min(before, Math.round(heroPw(world, me) * mul * rand(0.85, 1.15)));
    r.pool = before - dmg; r.at = iso(now);
    let lost = 0;
    if (r.owner && max > 0) { const share = dmg / max; for (const g of GUARDS) { const k = Math.min(r.troops[g.k] || 0, Math.round((r.troops[g.k] || 0) * share)); r.troops[g.k] = (r.troops[g.k] || 0) - k; lost += k; } }
    clanCredit(world, me, {donate: 200}, now);
    const D = r.owner ? clanById(world, r.owner) : null;
    if (r.pool <= 0) {
      const prev = D; Object.assign(r, {owner: clan.id, troops: {}, gov: null, pool: null, inc_at: iso(now), shield: iso(now + SHIELD)});
      landsTick(world, now); r.pool = Math.round(maxDef(world, L, r) * 0.5);
      addClanXp(clan, 100 * L.tier);
      llog(r, now, '🚩', `[${clan.tag}] захватил ${L.name}${prev ? ` у [${prev.tag}]` : ''}. Последний удар: ${nameOf(p)}.`);
      tellClan(world, clan, `🚩 [${clan.tag}] захватил «${L.name}» (${TIERS[L.tier].name})! Последний удар — ${nameOf(p)}. Наймите гарнизон и выберите постройку в разделе «Земли клана».`, `land-cap:${L.id}:${now}`, now, notify, '🚩');
      if (prev) tellClan(world, prev, `🔥 [${clan.tag}] захватил нашу землю «${L.name}»! Отбейте её в разделе «Земли клана».`, `land-lost:${L.id}:${now}`, now, notify, '🔥');
      return done({hit: {dmg, captured: true, lost}});
    }
    if (D && !(r.warned && Date.parse(r.warned) > now - HOUR)) { r.warned = iso(now); tellClan(world, D, `🚨 [${clan.tag}] штурмует нашу землю «${L.name}»: оборона ${fmt(r.pool)} из ${fmt(maxDef(world, L, r))}. Усильте гарнизон!`, `land-hit:${L.id}:${Math.floor(now / HOUR)}`, now, notify, '🚨'); }
    llog(r, now, '⚔️', `${nameOf(p)} [${clan.tag}] нанёс ${fmt(dmg)} урона${lost ? `, пало защитников: ${lost}` : ''}.`);
    return done({hit: {dmg, captured: false, lost}});
  }
  if (!mine) return fail('Это не земля вашего клана.');
  if (path === '/api/ae-clanx/lands/hire') {
    if (!SPENDERS.includes(m.role)) return fail('Нанимать гарнизон могут глава, офицеры и казначей.', 403);
    const g = GUARDS.find(x => x.k === body.kind); if (!g) return fail('Нет таких воинов.');
    if (lv(fortOf(world, clan.id), 'barracks') < g.need) return fail(`Нужны Казармы ${g.need} ур. в Крепости клана.`);
    const T = TIERS[L.tier], count = GUARDS.reduce((s, x) => s + (r.troops[x.k] || 0), 0), n = Math.max(1, Math.min(T.cap - count, Math.floor(Number(body.n) || 10)));
    if (count >= T.cap) return fail(`В гарнизоне нет мест: ${count} из ${T.cap}.`);
    const cost = Math.round(g.hire * 0.6) * n; if (gold() < cost) return fail(`В казне не хватает: отряд стоит ${fmt(cost)} 🪙.`);
    const before = maxDef(world, L, r);
    clan.treasury_gold = gold() - cost; r.troops[g.k] = (r.troops[g.k] || 0) + n;
    r.pool = Math.min(maxDef(world, L, r), Math.round((r.pool ?? before) + (maxDef(world, L, r) - before)));  // fresh troops stand on the walls at once
    llog(r, now, g.icon, `${nameOf(p)} нанял(а) отряд: ${g.name} ×${n} (${fmt(cost)} 🪙).`);
    return done();
  }
  if (path === '/api/ae-clanx/lands/spec') {
    if (!SPENDERS.includes(m.role)) return fail('Строить могут глава, офицеры и казначей.', 403);
    const k = String(body.spec || ''); if (!SPECS[k]) return fail('Нет такой постройки.');
    const lvl = r.spec === k ? (r.specLvl || 0) + 1 : 1; if (lvl > SPEC_MAX) return fail('Максимальный уровень.');
    const cost = specCost(L.tier, lvl); if (gold() < cost) return fail(`В казне не хватает: нужно ${fmt(cost)} 🪙.`);
    const before = maxDef(world, L, r);
    clan.treasury_gold = gold() - cost; r.spec = k; r.specLvl = lvl;
    r.pool = Math.min(maxDef(world, L, r), Math.max(0, Math.round((r.pool ?? before) + (maxDef(world, L, r) - before))));
    llog(r, now, SPECS[k].icon, `${nameOf(p)}: ${SPECS[k].name} ${lvl} ур. (${fmt(cost)} 🪙).`);
    return done();
  }
  if (path === '/api/ae-clanx/lands/governor') {
    if (body.compId == null) {  // release
      if (!r.gov) return done();
      if (!same(r.gov.u, me) && !LEADERS.includes(m.role)) return fail('Снять чужого наместника могут глава и офицеры.', 403);
      llog(r, now, '👋', `${r.gov.name} больше не наместник.`); r.gov = null; r.pool = Math.min(r.pool ?? 0, maxDef(world, L, r)); return done();
    }
    if (r.gov && !same(r.gov.u, me) && !LEADERS.includes(m.role)) return fail('У земли уже есть наместник. Заменить его могут глава и офицеры.', 403);
    const c = rows(world, 'ae_companions').find(x => same(x.u, me) && same(x.id, body.compId)); if (!c) return fail('Соратник не найден.', 404);
    if (landsOf(world).some(x => x.gov && same(x.gov.compId, c.id) && x.id !== L.id)) return fail(`${c.name} уже управляет другой землёй.`);
    const before = maxDef(world, L, r);
    r.gov = {u: String(me), compId: c.id, name: c.name, img: compImg(c), lvl: c.lvl || 1, pw: govPw(c), ownerName: nameOf(p)};
    r.pool = Math.min(maxDef(world, L, r), Math.round((r.pool ?? before) + (maxDef(world, L, r) - before)));
    llog(r, now, '🧭', `${c.name} (соратник ${nameOf(p)}) назначен наместником.`);
    return done();
  }
  return fail('API не найден.', 404);
}
