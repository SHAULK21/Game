/** Shared by the forge and combat; checkpoints protect long-term investment. */
export const SHARPENABLE_TYPES = ['weapon','offhand','helmet','armor','pants','gloves','boots','ring','amulet','belt','cloak','artifact'];
export const sharpeningMultiplier = (level = 0) => 1 + Math.min(25, Math.max(0, level)) * 0.06;
export function sharpeningQuote(level: number, protectedAttempt: boolean, achievement = false) {
  const n = Math.min(25, Math.max(0, Math.floor(level)));
  const gold = Math.round(60 * Math.pow(1.25, Math.min(10, n)) * Math.pow(1.32, Math.max(0, n - 10)));
  const silver = Math.round(40 * Math.pow(1.22, Math.min(10, n)) * Math.pow(1.30, Math.max(0, n - 10)));
  const base = n < 5 ? 1 : n < 10 ? 0.75 : n < 15 ? 0.45 : n < 20 ? 0.30 : 0.20;
  return { gold, silver, protection: protectedAttempt ? Math.max(250, Math.round(silver * 1.5)) : 0,
    chance: Math.min(1, base + (achievement ? 0.03 : 0)), failureLevel: protectedAttempt ? n : Math.max(Math.floor(n / 5) * 5, n - 1) };
}
