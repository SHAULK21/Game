export const GAME_SAVE_KEY = 'aethelgard_save_v1_data';
export const resetVersionKey = (userId: string | number) => `aethelgard_reset_version_${userId}`;
export const readResetVersion = (userId: string | number) => {
  const version = Number(localStorage.getItem(resetVersionKey(userId)) || 0);
  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
};

// Preferences, Telegram identity and Premium are independent of character progress.
export function applyAccountReset(userId: string | number, version: number): boolean {
  if (!Number.isSafeInteger(version) || version < 0) return false;
  // This marker acknowledges a reset already handled on this device. Older clients
  // can save without resetVersion: comparing that field again deletes a NEW hero.
  if (version <= readResetVersion(userId)) return false;
  // A current-format save can also prove that this server epoch was already
  // accepted, even if the separate acknowledgement key is missing.
  try {
    const save = JSON.parse(localStorage.getItem(GAME_SAVE_KEY) || 'null');
    if (save?.player && save.resetVersion === version) {
      localStorage.setItem(resetVersionKey(userId), String(version));
      return false;
    }
  } catch { /* A corrupt save cannot acknowledge a reset. */ }
  localStorage.removeItem(GAME_SAVE_KEY);
  for (const prefix of ['aethelgard_market_income_', 'aethelgard_market_pending_', 'aethelgard_clan_creation_pending_', 'aethelgard_bulk_pending_', 'aethelgard_pvp_pending_', 'aethelgard_clan_project_pending_']) {
    localStorage.removeItem(prefix + userId);
  }
  localStorage.setItem(resetVersionKey(userId), String(version));
  return true;
}
