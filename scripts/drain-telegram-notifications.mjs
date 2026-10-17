import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG = 'false';
try {
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
  sources['endpoints/scheduledDrain'] = "import {drainDeliveries} from '../lib/deliveryWorker.js'; export default async function () {return await drainDeliveries(10);}";
  const result = await runFunction(await resolveToken(), 'endpoints/scheduledDrain', sources, {}, {});
  console.log(JSON.stringify(result.result));
} catch (error) {console.error('Notification drain failed:', error.status || error.code || error.name || 'UNKNOWN'); process.exitCode = 1;}
