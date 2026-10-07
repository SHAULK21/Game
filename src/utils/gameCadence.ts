import type { PlayerCharacter } from '../types/game';
export const ENERGY_REGEN_MS = 120000;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const nextArenaReset = (now = Date.now()) => { const date = new Date(now); date.setUTCHours(24,0,0,0); return date.getTime(); };
const resources = [
  ['energy', 'maxEnergy', 'lastEnergyRegenTimestamp', ENERGY_REGEN_MS],
  ['stamina', 'maxStamina', 'lastStaminaRegenTimestamp', 10000],
  ['alchemyEnergy', 'maxAlchemyEnergy', 'lastAlchemyRegenTimestamp', 20000],
] as const;
/** Start a fresh regeneration period when spending a previously full resource. */
export function anchorSpentResources(previous: PlayerCharacter, next: PlayerCharacter, now = Date.now()): PlayerCharacter {
  let result = next;
  for (const [value, max, timestamp] of resources) {
    if (previous[value] >= previous[max] && next[value] < next[max] && next[timestamp] === previous[timestamp]) {
      if (result === next) result = {...next};
      result[timestamp] = now;
    }
  }
  return result;
}
export function refreshGameTimers(player: PlayerCharacter, now = Date.now()): PlayerCharacter {
  let result = player;
  for (const [value, max, timestamp, interval] of resources) {
    if (!Number.isFinite(player[value]) || !Number.isFinite(player[max]) || player[value] >= player[max]) continue;
    const last = Math.min(now, player[timestamp] ?? player.lastActiveTimestamp ?? now);
    const ticks = Math.max(0, Math.floor((now - last) / interval));
    if (!ticks) continue;
    if (result === player) result = {...player};
    result[value] = Math.min(player[max], player[value] + ticks);
    result[timestamp] = result[value] >= player[max] ? now : last + ticks * interval;
  }
  const day = utcDay(now);
  if (player.lastArenaTicketRefresh !== day) {
    if (result === player) result = {...player};
    result.arenaTickets = Math.max(5, player.arenaTickets);
    result.lastArenaTicketRefresh = day;
  }
  return result;
}
export const scarcity = (value: number, multiplier: number) => Math.max(0, Math.floor(value * multiplier));

export const miningYield = (base: number) => Math.max(1, scarcity(base, 0.45));
