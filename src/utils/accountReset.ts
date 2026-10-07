// Legacy key is read only during owner-checked migration.
export const GAME_SAVE_KEY = 'aethelgard_save_v1_data';
export const gameSaveKey = (userId: string | number) => `${GAME_SAVE_KEY}_${userId}`;
export function readAccountSave(userId: string | number): string | null {
  const ownKey = gameSaveKey(userId);
  const raw = localStorage.getItem(ownKey) ?? localStorage.getItem(GAME_SAVE_KEY);
  if (!raw) return null;
  try {
    const save = JSON.parse(raw);
    if (!save?.player || String(save.player.userId) !== String(userId)) return null;
    if (!localStorage.getItem(ownKey)) {
      localStorage.setItem(ownKey,raw);
      localStorage.removeItem(GAME_SAVE_KEY);
    }
    return raw;
  } catch { return null; }
}
export function removeAccountSave(userId: string | number) {
  localStorage.removeItem(gameSaveKey(userId));
  try {
    const legacy = JSON.parse(localStorage.getItem(GAME_SAVE_KEY) || 'null');
    if (String(legacy?.player?.userId) === String(userId)) localStorage.removeItem(GAME_SAVE_KEY);
  } catch { /* Keep unowned/corrupt legacy data for recovery, never load it. */ }
}
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
    const save = JSON.parse(readAccountSave(userId) || 'null');
    if (save?.player && save.resetVersion === version) {
      localStorage.setItem(resetVersionKey(userId), String(version));
      return false;
    }
  } catch { /* A corrupt save cannot acknowledge a reset. */ }
  removeAccountSave(userId);
  for (const prefix of ['aethelgard_rpc_pending_', 'aethelgard_market_income_', 'aethelgard_market_pending_', 'aethelgard_market_purchase_pending_', 'aethelgard_residents_pending_', 'aethelgard_clan_creation_pending_', 'aethelgard_bulk_pending_', 'aethelgard_pvp_pending_', 'aethelgard_clan_project_pending_']) {
    localStorage.removeItem(prefix + userId);
  }
  localStorage.setItem(resetVersionKey(userId), String(version));
  return true;
}
