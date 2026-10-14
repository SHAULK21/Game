import type { PlayerCharacter } from '../types/game';
import { flightBattlesLeft } from './flightPenalty';

export const BEER_ENERGY = 10;
export const INTOXICATION_BATTLES = 3;
export const INTOXICATION_PER_MUG = 5;
export const MAX_INTOXICATION_MUGS = 10;
/** Sanitize persisted effects, including non-finite values from old saves. */
export function normalizeIntoxication(value: PlayerCharacter['intoxication']): PlayerCharacter['intoxication'] {
  if (!value || !Number.isFinite(value.mugs) || !Number.isFinite(value.battlesLeft)) return undefined;
  const mugs = Math.max(0, Math.min(MAX_INTOXICATION_MUGS, Math.floor(value.mugs)));
  const battlesLeft = Math.max(0, Math.min(INTOXICATION_BATTLES, Math.floor(value.battlesLeft)));
  return mugs && battlesLeft ? { mugs, battlesLeft } : undefined;
}
export function intoxicationPercent(player: PlayerCharacter | null) {
  return (normalizeIntoxication(player?.intoxication)?.mugs ?? 0) * INTOXICATION_PER_MUG;
}
export function canDrinkBeer(player: PlayerCharacter) {
  return player.energy < player.maxEnergy || flightBattlesLeft(player) > 0;
}
export function drinkTavernBeer(player: PlayerCharacter): PlayerCharacter {
  if (!canDrinkBeer(player)) return player;
  const previous = normalizeIntoxication(player.intoxication);
  return {
    ...player,
    energy: Math.min(player.maxEnergy, player.energy + BEER_ENERGY),
    flightPenalty: player.flightPenalty ? { ...player.flightPenalty, battlesLeft: 0 } : undefined,
    intoxication: { mugs: Math.min(MAX_INTOXICATION_MUGS, (previous?.mugs ?? 0) + 1), battlesLeft: INTOXICATION_BATTLES }
  };
}
/** Victory and defeat count; fleeing and visiting town never sober the hero. */
export function completeIntoxicatedBattle(player: PlayerCharacter): PlayerCharacter {
  const effect = normalizeIntoxication(player.intoxication);
  if (!effect) return player;
  return { ...player, intoxication: effect.battlesLeft > 1 ? { ...effect, battlesLeft: effect.battlesLeft - 1 } : undefined };
}
