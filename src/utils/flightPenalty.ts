import type { PlayerCharacter } from '../types/game';
export const FLIGHT_PENALTY_BATTLES = 3;
export const FLIGHT_PENALTY_PERCENT = 10;
export function flightBattlesLeft(player: PlayerCharacter | null) {
  return Math.max(0, Math.min(3, Math.floor(Number(player?.flightPenalty?.battlesLeft) || 0)));
}
export function recordFlight(player: PlayerCharacter): PlayerCharacter {
  return { ...player, flightPenalty: {
    battlesLeft: FLIGHT_PENALTY_BATTLES,
    warningSeen: true,
    warningPending: !player.flightPenalty?.warningSeen || !!player.flightPenalty.warningPending
  }};
}
export function completePenalizedBattle(player: PlayerCharacter): PlayerCharacter {
  if (!flightBattlesLeft(player)) return player;
  return { ...player, flightPenalty: { ...player.flightPenalty!, battlesLeft: flightBattlesLeft(player) - 1 } };
}
