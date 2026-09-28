import { StatusEffect } from '../types/game';

export interface StatusModifiers {
  skipTurn: boolean;
  attackMultiplier: number;
  damageTakenMultiplier: number;
  invulnerable: boolean;
}

export interface StatusTickResult extends StatusModifiers {
  effects: StatusEffect[];
  damage: number;
}

/**
 * Reads active effects without consuming a turn.
 * This is used when resolving damage inside the current turn.
 */
export function getStatusModifiers(effects: StatusEffect[]): StatusModifiers {
  let attackMultiplier = 1;
  let damageTakenMultiplier = 1;
  let skipTurn = false;
  let invulnerable = false;

  for (const effect of effects) {
    if (effect.type === 'fury') {
      attackMultiplier *= 1 + Math.max(0, effect.value) / 100;
    }
    if (effect.type === 'fortify') {
      damageTakenMultiplier *= Math.max(0, 1 - Math.max(0, effect.value) / 100);
    }
    if (effect.type === 'vulnerability') {
      damageTakenMultiplier *= 1 + Math.max(0, effect.value) / 100;
    }
    if (effect.type === 'haste') {
      attackMultiplier *= 1 + Math.max(0, effect.value) / 100;
    }
    if (effect.type === 'stun' || effect.type === 'freeze') {
      skipTurn = true;
    }
    if (effect.type === 'invulnerable') {
      invulnerable = true;
    }
  }

  return {
    skipTurn,
    attackMultiplier,
    damageTakenMultiplier,
    invulnerable
  };
}

/**
 * Applies periodic damage/control at the start of an affected unit's turn,
 * then reduces duration by one. Effects with zero duration are removed.
 */
export function tickStatusEffects(effects: StatusEffect[]): StatusTickResult {
  const modifiers = getStatusModifiers(effects);
  let damage = 0;

  for (const effect of effects) {
    if (effect.type === 'poison' || effect.type === 'bleed' || effect.type === 'burn') {
      damage += Math.max(0, effect.value);
    }
  }

  return {
    ...modifiers,
    damage: Math.round(damage * modifiers.damageTakenMultiplier),
    effects: effects
      .map(effect => ({ ...effect, duration: effect.duration - 1 }))
      .filter(effect => effect.duration > 0)
  };
}

/**
 * Same-type effects refresh their duration and keep the stronger value.
 */
export function applyStatusEffect(effects: StatusEffect[], next: StatusEffect): StatusEffect[] {
  const index = effects.findIndex(effect => effect.type === next.type);
  if (index < 0) return [...effects, { ...next }];

  return effects.map((effect, i) =>
    i === index
      ? {
          ...effect,
          name: next.name || effect.name,
          duration: Math.max(effect.duration, next.duration),
          value: Math.max(effect.value, next.value)
        }
      : effect
  );
}
