import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import path from 'node:path';

export async function verifySnapshot(directory) {
  const root = path.resolve(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'game-postgres-snapshot-v1' || manifest.complete !== true || !Array.isArray(manifest.tables)) {
    throw new Error('Snapshot is incomplete or has an unsupported format.');
  }
  const results = [];
  const names = new Set();
  for (const entry of manifest.tables) {
    if (!/^\d+\.ndjson$/.test(entry.file) || names.has(entry.table)) throw new Error('Invalid snapshot manifest.');
    names.add(entry.table);
    const filename = path.join(root, entry.file);
    const stat = await fs.stat(filename);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    if (stat.size !== entry.bytes || hash.digest('hex') !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.table}`);
    let rows = 0;
    for await (const line of createInterface({input: createReadStream(filename), crlfDelay: Infinity})) {
      const document = JSON.parse(line);
      if (!document || Array.isArray(document) || typeof document !== 'object') throw new Error('Invalid snapshot row.');
      rows++;
    }
    if (rows !== entry.rows) throw new Error(`Row count mismatch: ${entry.table}`);
    results.push({table: entry.table, rows, bytes: stat.size});
  }
  const result = {verifiedAt: new Date().toISOString(), snapshotAt: manifest.snapshot_at,
    tables: results.length, rows: results.reduce((sum, entry) => sum + entry.rows, 0),
    bytes: results.reduce((sum, entry) => sum + entry.bytes, 0),
    integrity: 'SHA-256 and row counts match the exported files; restore has not been tested.',
    details: results};
  await fs.writeFile(path.join(root, 'verification.json'), JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[2]) {
  try {
    const result = await verifySnapshot(process.argv[2]);
    console.log(JSON.stringify({tables: result.tables, rows: result.rows, bytes: result.bytes, verified: true}));
  } catch {
    console.error('Snapshot verification failed.'); process.exitCode = 1;
  }
} else if (process.argv[1]?.endsWith('verify-migration-snapshot.mjs')) {
  console.error('Usage: node scripts/verify-migration-snapshot.mjs <snapshot-directory>'); process.exitCode = 1;
}
