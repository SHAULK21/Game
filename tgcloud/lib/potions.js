// Bag potions in the server-run fights (Horde, co-op, duels, clan raid and boss hunt).
// The bag lives in the game's own save: the game removes the potion it drinks and reports which one.
// The server never trusts the reported stats — it takes the potion's power from this table (by recipe / template id,
// the same numbers as the main fight). Drinking or throwing does not spend the turn; one potion per turn.

// [name, stats] — heal, healFull, mana, atk %, def %, crit %, invuln, turns, throw damage + type
const T = {
  pot_hp_small: {heal: 150}, alc_hp_small: {heal: 120}, pot_hp_large: {heal: 350}, pot_hp_great: {heal: 650}, alc_hp_great: {heal: 650},
  pot_mp_small: {mana: 80}, alc_mp_small: {mana: 80}, alc_mp_mid: {mana: 260}, alc_mp_great: {mana: 650},
  alc_berserk: {atk: 25, crit: 15, turns: 5}, alc_stoneskin: {def: 40, turns: 5}, alc_dragon_blood: {healFull: 1, inv: 1},
  alc_fish_water: {heal: 120, mana: 60}, alc_fish_scale: {def: 20, turns: 3}, alc_fish_hunter: {atk: 15, crit: 5, turns: 3},
  alc_fish_ice: {heal: 180, def: 25, turns: 4}, alc_fish_rune: {mana: 400, def: 25, turns: 4},
  alc_iron: {heal: 200, def: 30, turns: 3}, alc_clarity: {mana: 150, crit: 10, turns: 3}, alc_rage: {atk: 30, turns: 3},
  alc_hawk: {crit: 20, turns: 4}, alc_titan: {atk: 25, def: 25, turns: 4},
  alc_throw_fire: {throw: 90, type: 'fire'}, alc_throw_venom: {throw: 220, type: 'poison'}, alc_throw_frost: {throw: 480, type: 'ice'}, alc_viper: {throw: 650, type: 'poison'},
};
const ICON = {heal: '🧪', mana: '💧', buff: '✨', fire: '🔥', poison: '☠️', ice: '❄️'};

/** What a bag potion does, from the server's own table. it: {templateId, name}. null if it is not a combat potion. */
export function potionFx(it) {
  const id = String(it?.templateId || ''), name = String(it?.name || 'Зелье').slice(0, 40);
  let fx = T[id];
  const reg = /^alc_regional_(\d{1,3})_(hp|mp)$/.exec(id);  // regional infusions: «Настой здоровья / маны · ур. N»
  if (!fx && reg) { const L = Math.min(200, Number(reg[1])); fx = reg[2] === 'hp' ? {heal: 150 + L * 25} : {mana: 80 + L * 10}; }
  if (!fx) fx = /ман/i.test(name) ? {mana: 80} : /исцел|здоров|жизн|лечеб/i.test(name) ? {heal: 150} : null;  // quest / shop potions: the small ones
  if (!fx) return null;
  return {...fx, name, icon: fx.throw ? ICON[fx.type] : fx.atk || fx.def || fx.crit || fx.inv ? ICON.buff : fx.mana && !fx.heal ? ICON.mana : ICON.heal};
}

// Potion buffs on a fighter: f.pb = {atk, def, crit, turns, inv}
export const pbAtk = f => 1 + (f?.pb?.atk || 0) / 100;
export const pbCrit = f => (f?.pb?.crit || 0) / 100;
/** Incoming damage multiplier; invulnerability absorbs one hit. */
export function pbIn(f) { const b = f?.pb; if (!b) return 1; if (b.inv > 0) { b.inv--; return 0; } return 1 - Math.min(0.6, (b.def || 0) / 200); }
/** Call once per own turn. */
export function pbTick(f) { const b = f?.pb; if (!b) return; if (--b.turns <= 0 && !(b.inv > 0)) f.pb = null; }

/**
 * Drink or throw. f: {hp, maxHp, mp, maxMp, pb, potTurn}; turn: the fight's turn counter (one potion per turn).
 * hitFoe(dmg, fx) applies a throw to the enemy and returns the damage dealt. Returns {ok, text} or {error}.
 */
export function usePotion(f, it, turn, hitFoe) {
  const fx = potionFx(it); if (!fx) return {error: 'Это зелье нельзя использовать в бою.'};
  if (f.potTurn === turn) return {error: 'За ход можно использовать одно зелье. Следующее — после хода противника.'};
  const parts = [];
  if (fx.throw) {
    const dmg = hitFoe(fx.throw, fx); parts.push(`−${dmg}`);
    if (fx.type === 'poison') parts.push('отравление на 3 хода');
  } else {
    if (fx.healFull || fx.heal) { const v = fx.healFull ? f.maxHp - f.hp : Math.min(fx.heal, f.maxHp - f.hp); f.hp += Math.max(0, v); parts.push(`+${Math.max(0, v)} HP`); }
    if (fx.mana) { const v = Math.min(fx.mana, (f.maxMp || 100) - (f.mp || 0)); f.mp = (f.mp || 0) + Math.max(0, v); parts.push(`+${Math.max(0, v)} MP`); }
    if (fx.atk || fx.def || fx.crit || fx.inv) {
      const b = f.pb || {atk: 0, def: 0, crit: 0, turns: 0, inv: 0};
      f.pb = {atk: Math.max(b.atk, fx.atk || 0), def: Math.max(b.def, fx.def || 0), crit: Math.max(b.crit, fx.crit || 0), turns: Math.max(b.turns, fx.turns || 1), inv: Math.max(b.inv || 0, fx.inv || 0)};
      if (fx.atk) parts.push(`+${fx.atk}% атаки`); if (fx.def) parts.push(`+${fx.def}% защиты`); if (fx.crit) parts.push(`+${fx.crit}% крита`); if (fx.inv) parts.push('неуязвимость на 1 удар');
      if (fx.turns) parts.push(`${fx.turns} хода`);
    }
  }
  f.potTurn = turn;
  return {ok: true, fx, text: `${fx.icon} ${fx.throw ? 'Бросок' : 'Зелье'} «${fx.name}»: ${parts.join(', ')} · ход сохранён`};
}
/** A throw's damage: power (+25% for rogues), softened by the target's defence like a magic hit. */
export const throwDmg = (fx, classId, def = 0) => Math.max(1, Math.round(fx.throw * (classId === 'rogue' ? 1.25 : 1) * (1 - Math.min(0.5, def / (def + 300)))));
export const poisonDot = (fx, classId) => fx.type === 'poison' ? {name: 'Отравление', icon: '☠️', per: Math.max(1, Math.round(fx.throw * (classId === 'rogue' ? 1.25 : 1) * 0.15)), left: 3} : null;
