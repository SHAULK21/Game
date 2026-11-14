// The hero's own skills and talent bonuses, shared by co-op, duels and the Horde.
// The game client builds the "kit" from the hero's save (skill rank, talent tree) — the same math as the
// main combat — and the server clamps every number. Skills cost mana only: no cooldowns.
const n = (v, lo, hi, d = lo) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const FX = new Set(['stun', 'freeze', 'shield', 'bleed', 'poison', 'burn', 'fury', 'vulnerability', 'fortify', 'haste', 'invulnerable']);
const TALENTS = ['alternatingDamage', 'executeDamage', 'afflictedDamage', 'offensiveStance', 'defensiveStance', 'skillManaReturn', 'critMana', 'shieldPower',
  'defendHeal', 'blockMana', 'killRecovery', 'lowHpReduction', 'dotPower', 'healPower', 'critFollowup', 'momentumDamage', 'vulnerabilityPower',
  'bleedChance', 'poisonChance', 'burnChance'];

export function cleanKit(raw, level = 1) {
  if (!raw || typeof raw !== 'object') return null;
  const skills = (Array.isArray(raw.skills) ? raw.skills : []).slice(0, 14).map(s => {
    if (!s || !/^[a-z0-9_]{2,40}$/i.test(String(s.id || '')) || n(s.levelReq, 1, 200, 1) > level) return null;
    const f = s.inflicts && FX.has(s.inflicts.type) ? {type: s.inflicts.type, chance: n(s.inflicts.chance, 0, 1, 1), duration: Math.round(n(s.inflicts.duration, 1, 5, 2)), power: n(s.inflicts.power, 0, 300, 30)} : null;
    return {id: String(s.id), name: String(s.name || 'Навык').slice(0, 40), icon: String(s.icon || '✨').slice(0, 4), desc: String(s.desc || '').slice(0, 160),
      mana: Math.round(n(s.mana, 0, 400, 20)), mult: n(s.mult, 0, 5, 0), heal: n(s.heal, 0, 5, 0), type: /^[a-z]{3,12}$/.test(s.type || '') ? s.type : 'physical',
      comboFrom: /^[a-z0-9_]{2,40}$/i.test(String(s.comboFrom || '')) ? String(s.comboFrom) : null, comboMult: n(s.comboMult, 1, 2, 1.25),
      comboAlt: (Array.isArray(s.comboAlt) ? s.comboAlt : []).filter(x => /^[a-z0-9_]{2,40}$/i.test(String(x))).slice(0, 4).map(String),
      armorBreak: n(s.armorBreak, 0, 0.5, 0), execT: n(s.execT, 0, 0.5, 0), execM: n(s.execM, 1, 3, 1.5), inf: f};
  }).filter(Boolean);
  const t = {}; for (const k of TALENTS) { const v = n(raw.talents?.[k], 0, k.endsWith('Chance') ? 60 : 200, 0); if (v) t[k] = v; }
  return {skills, talents: t};
}

// Cross-hero combos: what an ally's last skill sets up for yours.
export const CROSS = {
  stun: ['💥', 'Удар по беззащитному', 1.5], freeze: ['💥', 'Удар по беззащитному', 1.5], vulnerability: ['🎯', 'Сокрушение уязвимого', 1.4],
  bleed: ['🩸', 'Детонация ран', 1.35], poison: ['☠️', 'Детонация яда', 1.35], burn: ['🔥', 'Вспышка пламени', 1.35],
  shield: ['🛡️', 'Боевое братство', 1.25], fortify: ['🛡️', 'Боевое братство', 1.25], fury: ['📯', 'Общий натиск', 1.3], haste: ['📯', 'Общий натиск', 1.3], heal: ['✨', 'Благословение', 1.2]};
export const setupOf = sk => sk ? (sk.inf?.type || (sk.heal > 0 && !sk.mult ? 'heal' : null)) : null;
export function crossPreview(allyLast, sk) { const k = setupOf(allyLast); return k && CROSS[k] && sk.mult > 0 ? {icon: CROSS[k][0], name: CROSS[k][1], mult: CROSS[k][2]} : null; }

// Use a skill. ctx: {self, foe, kit, sk, ownLast, allyLast, allyName, hit(mult, ignoreDef) -> dmg, healTarget}
// self: {hp, maxHp, mp, maxMp, atk, crit, barrier, fury}; foe: {hp, maxHp, dots, stunned, vuln}
export function castSkill(ctx) {
  const {self, foe, kit, sk} = ctx, t = kit?.talents || {}, parts = []; let combo = null;
  if (sk.mult > 0) {
    let m = sk.mult;
    if (ctx.ownLast && (ctx.ownLast.id === sk.comboFrom || sk.comboAlt?.includes(ctx.ownLast.id))) { m *= sk.comboMult; parts.push('🔗 связка навыков'); }
    if (t.alternatingDamage && ctx.ownLast && ctx.ownLast.id !== sk.id) m *= 1 + t.alternatingDamage / 100;
    if (sk.execT && foe.hp / foe.maxHp <= sk.execT) m *= sk.execM;
    if (foe.hp / foe.maxHp < 0.3) m *= 1 + (t.executeDamage || 0) / 100;
    if (t.afflictedDamage && ((foe.dots || []).length || foe.vuln > 0)) m *= 1 + t.afflictedDamage / 100;
    if (t.offensiveStance && self.hp / self.maxHp > 0.7) m *= 1 + t.offensiveStance / 100;
    if (t.defensiveStance) m *= 0.9;
    const cp = crossPreview(ctx.allyLast, sk);
    if (cp) {
      m *= cp.mult; combo = {...cp, with: ctx.allyName};
      const k = setupOf(ctx.allyLast);
      if (['bleed', 'poison', 'burn'].includes(k)) for (const d of foe.dots || []) { foe.hp = Math.max(0, foe.hp - d.per); parts.push(`${d.icon} −${d.per}`); }
    }
    const crit = Math.random() < (self.crit || 0.12), dmg = ctx.hit(m * (crit ? 1.6 : 1), sk.armorBreak);
    parts.unshift(`−${dmg}${crit ? ' (крит!)' : ''}`);
    if (crit && t.critMana) self.mp = Math.min(self.maxMp, self.mp + Math.round(self.maxMp * t.critMana / 100));
  }
  if (sk.heal > 0) {
    const tg = ctx.healTarget || self, amount = Math.round(tg.maxHp * Math.min(0.5, 0.1 + sk.heal * 0.1) * (1 + (t.healPower || 0) / 100) * (combo ? 1 : 1));
    tg.hp = Math.min(tg.maxHp, tg.hp + amount); parts.push(`${tg === self ? '' : tg.name + ' '}+${amount} HP`);
  }
  const f = sk.inf;
  if (f && Math.random() < f.chance) {
    if (f.type === 'stun' || f.type === 'freeze') { foe.stunned = 1; parts.push(f.type === 'freeze' ? 'враг заморожен' : 'враг оглушён'); }
    else if (f.type === 'shield' || f.type === 'fortify' || f.type === 'invulnerable') { const b = Math.round(self.maxHp * Math.min(0.4, 0.08 + f.power / 500) * (1 + (t.shieldPower || 0) / 100)); self.barrier = (self.barrier || 0) + b; parts.push(`щит ${b}`); }
    else if (f.type === 'fury' || f.type === 'haste') { self.fury = f.duration + 1; parts.push('ярость +30% урона'); }
    else if (f.type === 'vulnerability') { foe.vuln = f.duration + 1; parts.push('враг уязвим'); }
    else { const ic = {bleed: '🩸', poison: '🧪', burn: '🔥'}[f.type], nm = {bleed: 'Кровотечение', poison: 'Яд', burn: 'Горение'}[f.type];
      (foe.dots ||= []).push({icon: ic, name: nm, per: Math.max(1, Math.round(self.atk * Math.max(0.15, f.power / 100) * (1 + (t.dotPower || 0) / 100))), left: f.duration}); parts.push(nm.toLowerCase()); }
  }
  if (t.skillManaReturn) self.mp = Math.min(self.maxMp, self.mp + Math.round(self.maxMp * t.skillManaReturn / 100));
  return {parts, combo};
}
// Damage multipliers that live on the actors between turns.
export const outMult = actor => (actor.fury > 0 ? 1.3 : 1);
export const inMult = foe => (foe.vuln > 0 ? 1.3 : 1);

// Crystals in the hero's gear: chance to bleed / poison / burn the target on a hit (same as the monster fight).
export function gemProcs(self, foe, kit) {
  const t = kit?.talents || {}, out = [];
  for (const [k, icon, name] of [['bleedChance', '🩸', 'Кровотечение'], ['poisonChance', '🧪', 'Яд'], ['burnChance', '🔥', 'Поджог']]) {
    if (!(t[k] > 0) || Math.random() * 100 >= Math.min(60, t[k])) continue;
    (foe.dots ||= []).push({icon, name: name + ' (кристалл)', per: Math.max(4, Math.round((self.atk || 20) * 0.15)), left: 3}); out.push(`💎 ${name.toLowerCase()}`);
  }
  return out;
}
