import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG = 'false';
const check = process.argv[2];
if (!/^[a-zA-Z]+$/.test(check || '')) throw new Error('Supply a check name under scripts/staging.');
try {
  const sources = {};
  async function collect(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const filename = path.join(directory, entry.name), name = prefix + entry.name;
      if (entry.isDirectory()) await collect(filename, name + '/');
      else if (entry.name.endsWith('.js')) sources[name.slice(0, -3)] = await fs.readFile(filename, 'utf8');
    }
  }
  await collect('tgcloud');
  sources['endpoints/nativeCheck'] = await fs.readFile('scripts/staging/' + check + '.js', 'utf8');
  const response = await runFunction(await resolveToken(), 'endpoints/nativeCheck', sources, {}, {});
  console.log(JSON.stringify(response.result));
} catch (error) {console.error('Native check failed:', error.status || error.code || error.name || 'UNKNOWN', String(error.description || error.message || '').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 1000)); process.exitCode = 1;}
