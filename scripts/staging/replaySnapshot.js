import {db} from 'sdk';
import {GameActor, refreshGameTimers, validateNativeWorld, handleProgressRequest} from '../lib/gameEngine.js';

// CLI-only validation: reconstructs actors in memory. No database writes.
export default async function (input) {
  if (!/^staging:[a-f0-9]{64}$/.test(input?.key || '')) throw new Error('Invalid staging key.');
  const row = await db.get('SELECT document FROM game_atomic_documents WHERE id=:id', {':id': input.key});
  if (!row) throw new Error('Staging snapshot not found.');
  const world = JSON.parse(row.document), now = Date.now();
  validateNativeWorld(world);
  const result = {sourcePlayers: world.tables.players.length, canonicalPlayers: 0, restoredPlayers: 0, apiReaders: 0, issues: []};
  for (const [index, account] of world.tables.players.entries()) {
    try {
      const response = await handleProgressRequest(world, {path: '/api/progress'}, {id: Number(account.telegram_id),
        username: account.username || undefined, displayName: account.display_name || 'Игрок'}, {now: () => now});
      if (response.status !== 200 || String(response.body.ownerId) !== String(account.telegram_id)) throw new Error('Invalid account projection.');
      validateNativeWorld(world); result.apiReaders++;
    } catch (error) {result.issues.push({index, code: error.code || error.name || 'ACCOUNT_READ_FAILURE'});}
  }
  for (const [index, account] of world.tables.players.entries()) {
    if (!account.progress_json || account.character_authority !== 'server-actions-v1') continue;
    result.canonicalPlayers++;
    try {
      const save = account.progress_json;
      if (String(save.player?.userId) !== String(account.telegram_id) || save.actor?.version !== 1) throw new Error('Invalid canonical save.');
      const inventory = [], equipped = {};
      const owned = world.tables.owned_items.filter(item => String(item.owner_telegram_id) === String(account.telegram_id));
      for (const item of owned) {
        const value = {...item.item_json, id: item.id, stackCount: Number(item.quantity), isLocked: item.locked,
          isEquipped: !!item.equipped_slot, boundToClan: item.bound_clan_id || undefined,
          serverOwned: false, marketTradable: !['legacy_market_return', 'legacy_character'].includes(item.origin)};
        if (item.equipped_slot) equipped[item.equipped_slot] = value; else inventory.push(value);
      }
      const player = refreshGameTimers({...save.player, inventory, equipped,
        marketGold: Number(account.market_gold || 0), clanId: account.clan_id || undefined}, now);
      const actor = await new GameActor({user: {id: Number(account.telegram_id), first_name: account.display_name,
          username: account.username || undefined}, resetVersion: Number(account.reset_version), locale: 'ru', admin: false,
        premium: {active: new Date(account.premium_until || 0).getTime() > now,
          premiumUntil: account.premium_until || null, priceStars: 150, periodDays: 30}, now: () => now,
        automationAllowed: false, snapshot: {...save.actor, state: {...save.actor.state,
          player, quests: save.quests, achievements: save.achievements, activeDungeonRun: save.activeDungeonRun}},
      }).initialize();
      const restored = actor.current.player;
      if (!restored || restored.id !== save.player.id || String(restored.userId) !== String(account.telegram_id)) throw new Error('Restored ownership mismatch.');
      if (actor.snapshot().version !== 1) throw new Error('Unsupported restored snapshot.');
      result.restoredPlayers++;
    } catch (error) {result.issues.push({index, code: error.code || error.name || 'ENGINE_FAILURE'});}
  }
  return result;
}
