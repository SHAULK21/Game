// Injected only into a CLI test run, never a deployed endpoint.
import {db} from 'sdk';
import {createHash} from '../lib/gameEngine.js';

export default async function (input) {
  if (typeof input?.document !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error('Invalid staging snapshot.');
  if (createHash('sha256').update(input.document).digest('hex') !== input.sha256) throw new Error('Snapshot checksum mismatch.');
  const state = JSON.parse(input.document);
  if (state.format !== 'game-native-staging-v1' || !state.tables?.players || !state.tables?.owned_items) throw new Error('Incomplete source snapshot.');
  const key = 'staging:' + input.sha256;
  await db.run(`INSERT INTO game_atomic_documents(id,revision,document)
    VALUES (:id,0,:document) ON CONFLICT(id) DO NOTHING`, {':id': key, ':document': input.document});
  const stored = await db.get('SELECT document FROM game_atomic_documents WHERE id=:id', {':id': key});
  if (createHash('sha256').update(stored.document).digest('hex') !== input.sha256) throw new Error('Stored snapshot checksum mismatch.');
  return {verified: true, key, tables: Object.keys(state.tables).length,
    rows: Object.values(state.tables).reduce((total, rows) => total + rows.length, 0)};
}
