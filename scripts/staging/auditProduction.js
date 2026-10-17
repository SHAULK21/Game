import {db} from 'sdk';
import {validateNativeWorld, PRODUCTION_DOCUMENT, ADMIN_TELEGRAM_ID} from '../lib/gameEngine.js';
export default async function () {
  const row = await db.get('SELECT revision,document FROM game_atomic_documents WHERE id=:id', {':id': PRODUCTION_DOCUMENT});
  if (!row) throw new Error('Production missing.');
  const world = JSON.parse(row.document); validateNativeWorld(world);
  return {initialized: true, revision: row.revision, bytes: new TextEncoder().encode(row.document).length,
    accounts: world.tables.players.length, canonicalCharacters: world.tables.players.filter(player => player.character_authority === 'server-actions-v1' && player.progress_json).length,
    sourceSha256: world.deployment?.sourceSha256, adminConfigured: ADMIN_TELEGRAM_ID === 437290420, economyValid: true};
}
