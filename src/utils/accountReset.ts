export const GAME_SAVE_KEY = 'aethelgard_save_v1_data';
export const resetVersionKey = (userId: string | number) => `aethelgard_reset_version_${userId}`;
export const readResetVersion = (userId: string | number) => Number(localStorage.getItem(resetVersionKey(userId)) || 0);

// Preferences, Telegram identity and Premium are independent of character progress.
export function applyAccountReset(userId: string | number, version: number): boolean {
  if (!Number.isSafeInteger(version) || version < 0) return false;
  if (version < readResetVersion(userId)) return false;
  let saveVersion = readResetVersion(userId);
  try {
    const save = JSON.parse(localStorage.getItem(GAME_SAVE_KEY) || 'null');
    if (save?.player) saveVersion = Number(save.resetVersion || 0);
  } catch { saveVersion = 0; }
  const reset = version > saveVersion;
  if (reset) {
    localStorage.removeItem(GAME_SAVE_KEY);
    for (const prefix of ['aethelgard_market_income_', 'aethelgard_market_pending_', 'aethelgard_clan_creation_pending_', 'aethelgard_bulk_pending_', 'aethelgard_pvp_pending_', 'aethelgard_clan_project_pending_']) {
      localStorage.removeItem(prefix + userId);
    }
  }
  localStorage.setItem(resetVersionKey(userId), String(version));
  return reset;
}
