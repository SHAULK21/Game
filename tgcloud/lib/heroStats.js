// A hero's real combat stats (gear, attributes, talents, pet…) as the game client computes them.
// The client reports them; duels use them as is, Horde and co-op blend them with the level formula
// (sqrt), so gear clearly matters there without breaking the PvE balance.
import {cleanKit} from './skills.js';
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const CLASS = {warrior: {hp: 1.25, atk: 1.0, def: 1.3}, knight: {hp: 1.3, atk: 0.9, def: 1.4}, paladin: {hp: 1.15, atk: 0.95, def: 1.2}, berserker: {hp: 1.05, atk: 1.3, def: 0.85},
  rogue: {hp: 0.9, atk: 1.25, def: 0.8}, assassin: {hp: 0.85, atk: 1.35, def: 0.75}, hunter: {hp: 0.95, atk: 1.2, def: 0.85}, archer: {hp: 0.95, atk: 1.2, def: 0.85},
  mage: {hp: 0.8, atk: 1.4, def: 0.7}, necromancer: {hp: 0.9, atk: 1.25, def: 0.8}, druid: {hp: 1.0, atk: 1.0, def: 0.95}};

// The level formula the modes were balanced on.
export function baseStats(p) {
  const level = Math.max(1, Math.min(120, Number(p?.level) || 1)), c = CLASS[p?.class_id] || CLASS.warrior;
  return {level, maxHp: Math.round((160 + level * 48) * c.hp), atk: Math.round((18 + level * 7) * c.atk), def: Math.round((6 + level * 3) * c.def)};
}
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : null; };

// Store what the client reports, clamped to what a hero of this level can plausibly have.
export function saveStats(world, id, raw, now = Date.now()) {
  const p = rows(world, 'players').find(x => same(x.telegram_id, id)); if (!p || !raw || typeof raw !== 'object') return null;
  const b = baseStats(p);
  const maxHp = num(raw.maxHp, 50, b.maxHp * 8), atk = num(Math.max(Number(raw.attack) || 0, Number(raw.magicAttack) || 0), 5, b.atk * 8);
  const def = num(raw.defense, 0, b.def * 10), crit = num(raw.critChance, 0, 75), mp = num(raw.maxMp, 20, 400 + b.level * 60);
  if (maxHp == null || atk == null) return null;
  const list = rows(world, 'ae_combat_stats');
  let r = list.find(x => same(x.u, id)); if (!r) { r = {u: String(id)}; list.push(r); }
  Object.assign(r, {hp: maxHp, atk, def: def ?? b.def, crit: crit ?? 10, mp: mp ?? null, lvl: b.level, at: new Date(now).toISOString(),
    mdef: num(raw.magicDefense, 0, b.def * 10), cd: num(raw.critDamage, 100, 400), ev: num(raw.evasion, 0, 80), vamp: num(raw.vampirism, 0, 50), pen: num(raw.armorPenetration, 0, 60),
    hpr: num(raw.hpRegen, 0, maxHp), mpr: num(raw.mpRegen, 0, 400 + b.level * 60)});
  if (raw.kit) { const k = cleanKit(raw.kit, b.level); if (k) r.kit = k; }
  // The active companion, shown on the hero's profile.
  if (raw.pet === null) r.pet = null;
  else if (raw.pet && /^pet_[a-z_]{2,30}$/.test(String(raw.pet.id || ''))) r.pet = {id: String(raw.pet.id), name: String(raw.pet.name || 'Питомец').slice(0, 40), level: Math.max(1, Math.min(100, Math.floor(Number(raw.pet.level) || 1))),
    rarity: /^[a-z]{3,12}$/.test(raw.pet.rarity || '') ? raw.pet.rarity : 'common', hungry: !!raw.pet.hungry};
  return r;
}
// Real stats, or null if the hero never reported (or levelled up a lot since — then they are stale).
export function realStats(world, id, p) {
  const r = rows(world, 'ae_combat_stats').find(x => same(x.u, id)); if (!r) return null;
  if ((Number(p?.level) || 1) > (Number(r.lvl) || 1) + 5) return null;
  return {maxHp: r.hp, atk: r.atk, def: r.def, crit: Math.min(0.6, (r.crit || 0) / 100), maxMp: r.mp || null, critDmg: (r.cd || 160) / 100, evasion: r.ev || 0, vamp: r.vamp || 0, pen: r.pen || 0, hpRegen: r.hpr || 0, mpRegen: r.mpr || 0};
}
// For PvE modes: halfway (geometric) between the level formula and the real stats.
export function blendedStats(world, id, p) {
  const b = baseStats(p), r = realStats(world, id, p); if (!r) return {...b, crit: null, maxMp: null, real: false};
  const g = (x, y) => Math.max(1, Math.round(Math.sqrt(Math.max(1, x) * Math.max(1, y))));
  return {level: b.level, maxHp: g(b.maxHp, r.maxHp), atk: g(b.atk, r.atk), def: g(b.def, Math.max(1, r.def)), crit: r.crit, maxMp: r.maxMp, real: true};
}
// The hero's skills + talent bonuses (as last reported by the client), or an empty kit.
export function kitOf(world, id) { return rows(world, 'ae_combat_stats').find(x => same(x.u, id))?.kit || {skills: [], talents: {}}; }
