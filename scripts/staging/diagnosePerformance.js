import {db} from 'sdk';
import {NativePool, GameStore, compactGameReply, PRODUCTION_DOCUMENT, ADMIN_TELEGRAM_ID} from '../lib/gameEngine.js';
export default async function () {
  const begin = Date.now();
  const row = await db.get('SELECT document FROM game_atomic_documents WHERE id=:id', {':id': PRODUCTION_DOCUMENT});
  const readMs = Date.now() - begin, world = JSON.parse(row.document);
  const account = world.tables.players.find(row => Number(row.telegram_id) === ADMIN_TELEGRAM_ID);
  const pool = new NativePool(world), store = new GameStore(pool.asPool());
  const identity = {id: Number(account.telegram_id), displayName: account.display_name, username: account.username || undefined};
  const started = Date.now();
  // Pure private candidate: never commits or takes over the real writer session.
  const result = await store.load(identity, '', {tick: false});
  return {readMs, engineMs: Date.now() - started, bytes: new TextEncoder().encode(row.document).length,
    responseBytes: new TextEncoder().encode(JSON.stringify(result)).length,
    compactResponseBytes: new TextEncoder().encode(JSON.stringify(compactGameReply({status: 200, body: result}))).length,
    premiumActive: result.game?.premium?.active, autoEnabled: result.game?.autoBattle?.enabled,
    inCombat: result.game?.isInCombat, combatEnded: result.game?.isCombatEnded,
    phase: result.game?.turnPhase, chainRemaining: result.game?.combatChain?.queue?.length || 0,
    storyPending: !!result.game?.player?.adventureJournal?.pending,
    timerCount: Object.keys(account.progress_json?.actor?.timers || {}).length};
}
