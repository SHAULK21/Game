import type { PlayerCharacter } from '../types/game';
export const ENERGY_REGEN_MS = 120000;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const nextArenaReset = (now = Date.now()) => { const date = new Date(now); date.setUTCHours(24,0,0,0); return date.getTime(); };
export function refreshGameTimers(player: PlayerCharacter, now = Date.now()): PlayerCharacter {
  const day = utcDay(now);
  const last = Math.min(now, player.lastEnergyRegenTimestamp ?? player.lastActiveTimestamp ?? now);
  const ticks = Math.max(0, Math.floor((now - last) / ENERGY_REGEN_MS));
  const full = player.energy >= player.maxEnergy;
  if (!ticks && !full && player.lastArenaTicketRefresh === day) return player;
  return { ...player,
    energy: Math.min(player.maxEnergy, player.energy + ticks),
    lastEnergyRegenTimestamp: player.energy + ticks >= player.maxEnergy ? now : last + ticks * ENERGY_REGEN_MS,
    arenaTickets: player.lastArenaTicketRefresh === day ? player.arenaTickets : Math.max(5, player.arenaTickets),
    lastArenaTicketRefresh: day
  };
}
export const scarcity = (value: number, multiplier: number) => Math.max(0, Math.floor(value * multiplier));

export const miningYield = (base: number) => Math.max(1, scarcity(base, 0.45));
