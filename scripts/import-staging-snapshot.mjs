import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifySnapshot} from './verify-migration-snapshot.mjs';
// Use the CLI's credential resolver. Never read or parse its saved token files.
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';

if (!process.argv[2]) throw new Error('Supply the verified snapshot directory.');
// CLI debug output can include request bodies; keep player records out of logs.
process.env.TGCLOUD_DEBUG = 'false';
const directory = path.resolve(process.argv[2]);
try {
  await verifySnapshot(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const tables = {};
  for (const entry of manifest.tables) {
    const data = await fs.readFile(path.join(directory, entry.file), 'utf8');
    tables[entry.table] = data.trim() ? data.trimEnd().split('\n').map(line => JSON.parse(line, (_key, value, context) => {
      // PostgreSQL int8 may exceed JS integer precision. Retain its exact digits.
      if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
        if (!context?.source) throw new Error('JSON parser does not preserve integer source text.');
        return context.source;
      }
      return value;
    })) : [];
  }
  const document = JSON.stringify({format: 'game-native-staging-v1', sourceSnapshotAt: manifest.snapshot_at,
    schema: {columns: manifest.columns, constraints: manifest.constraints, indexes: manifest.indexes, sequences: manifest.sequences},
    tables, receipts: {}});
  const sha256 = createHash('sha256').update(document).digest('hex');
  const sources = {};
  async function collect(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const filename = path.join(directory, entry.name);
      const moduleName = prefix + entry.name;
      if (entry.isDirectory()) await collect(filename, moduleName + '/');
      else if (entry.name.endsWith('.js')) sources[moduleName.slice(0, -3)] = await fs.readFile(filename, 'utf8');
    }
  }
  await collect('tgcloud');
  sources['endpoints/stagingImport'] = await fs.readFile('scripts/staging/importSnapshot.js', 'utf8');
  const response = await runFunction(await resolveToken(), 'endpoints/stagingImport', sources, {sha256, document}, {});
  const report = {completedAt: new Date().toISOString(), sha256, sourceSnapshotAt: manifest.snapshot_at,
    rows: manifest.tables.reduce((sum, entry) => sum + entry.rows, 0), tables: manifest.tables.length,
    target: 'Telegram Serverless, isolated staging document', response: response.result};
  await fs.writeFile(path.join(directory, 'telegram-staging-import.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('Staging import failed:', error.status || error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
}
