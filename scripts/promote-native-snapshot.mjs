import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG = 'false';
if (!process.argv[2] || !process.argv.includes('--activate')) throw new Error('Supply a verified snapshot directory and --activate after cutover approval.');
try {
  const directory = path.resolve(process.argv[2]);
  const report = JSON.parse(await fs.readFile(path.join(directory, 'telegram-staging-import.json'), 'utf8'));
  const actors = JSON.parse(await fs.readFile(path.join(directory, 'telegram-actor-verification.json'), 'utf8'));
  if (!report.response?.verified || actors.issues?.length || actors.canonicalPlayers !== actors.restoredPlayers) throw new Error('Snapshot verification incomplete.');
  const sources = {};
  async function collect(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(directory, entry.name), name = prefix + entry.name;
      if (entry.isDirectory()) await collect(file, name + '/');
      else if (entry.name.endsWith('.js')) sources[name.slice(0, -3)] = await fs.readFile(file, 'utf8');
    }
  }
  await collect('tgcloud');
  sources['endpoints/promoteSnapshot'] = await fs.readFile('scripts/staging/promoteSnapshot.js', 'utf8');
  const response = await runFunction(await resolveToken(), 'endpoints/promoteSnapshot', sources, {sha256: report.sha256}, {});
  await fs.writeFile(path.join(directory, 'telegram-production-activation.json'), JSON.stringify(response.result, null, 2));
  console.log(JSON.stringify(response.result));
} catch (error) {console.error('Production activation failed:', error.status || error.code || error.name || 'UNKNOWN'); process.exitCode = 1;}
