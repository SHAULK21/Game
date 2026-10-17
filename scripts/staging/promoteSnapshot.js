import {db} from 'sdk';
import {createHash, validateNativeWorld, PRODUCTION_DOCUMENT} from '../lib/gameEngine.js';
export default async function (input) {
  if (!/^[a-f0-9]{64}$/.test(input?.sha256 || '')) throw new Error('Invalid snapshot hash.');
  const source = await db.get('SELECT document FROM game_atomic_documents WHERE id=:id', {':id': 'staging:' + input.sha256});
  if (!source || createHash('sha256').update(source.document).digest('hex') !== input.sha256) throw new Error('Source verification failed.');
  const world = JSON.parse(source.document); validateNativeWorld(world);
  if (world.format !== 'game-native-staging-v1') throw new Error('Unsupported source snapshot.');
  world.format = 'game-native-production-v1';
  world.deployment = {sourceSha256: input.sha256, activatedAt: new Date().toISOString()};
  for (const player of world.tables.players) {
    if (player.progress_session_hash) {player.progress_session_hash = null; player.progress_session_generation = Number(player.progress_session_generation) + 1;}
  }
  validateNativeWorld(world);
  await db.run('INSERT INTO game_atomic_documents(id,revision,document) VALUES(:id,0,:document) ON CONFLICT(id) DO NOTHING', {':id': PRODUCTION_DOCUMENT, ':document': JSON.stringify(world)});
  const saved = await db.get('SELECT revision,document FROM game_atomic_documents WHERE id=:id', {':id': PRODUCTION_DOCUMENT});
  const restored = JSON.parse(saved.document); validateNativeWorld(restored);
  if (restored.deployment?.sourceSha256 !== input.sha256) throw new Error('Existing production state belongs to a different snapshot; refusing overwrite.');
  return {initialized: true, sourceSha256: input.sha256, revision: saved.revision, accounts: restored.tables.players.length,
    canonicalCharacters: restored.tables.players.filter(row => row.character_authority === 'server-actions-v1' && row.progress_json).length};
}
