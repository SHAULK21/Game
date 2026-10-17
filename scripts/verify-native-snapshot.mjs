import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG = 'false';
if (!process.argv[2]) throw new Error('Supply the imported snapshot directory.');
try {
  const directory = path.resolve(process.argv[2]);
  const report = JSON.parse(await fs.readFile(path.join(directory, 'telegram-staging-import.json'), 'utf8'));
  const sources = {};
  async function collect(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const filename = path.join(directory, entry.name), moduleName = prefix + entry.name;
      if (entry.isDirectory()) await collect(filename, moduleName + '/');
      else if (entry.name.endsWith('.js')) sources[moduleName.slice(0, -3)] = await fs.readFile(filename, 'utf8');
    }
  }
  await collect('tgcloud');
  sources['endpoints/stagingReplay'] = await fs.readFile('scripts/staging/replaySnapshot.js', 'utf8');
  const response = await runFunction(await resolveToken(), 'endpoints/stagingReplay', sources,
    {key: 'staging:' + report.sha256}, {});
  await fs.writeFile(path.join(directory, 'telegram-actor-verification.json'), JSON.stringify(response.result, null, 2));
  console.log(JSON.stringify(response.result));
  if (response.result?.issues?.length || response.result?.canonicalPlayers !== response.result?.restoredPlayers) process.exitCode = 1;
} catch (error) {
  console.error('Native actor verification failed:', error.status || error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
}
