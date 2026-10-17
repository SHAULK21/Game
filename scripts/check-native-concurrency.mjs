import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG = 'false';
try {
  const sources = {'lib/atomicDocument': await fs.readFile('tgcloud/lib/atomicDocument.js', 'utf8'),
    'lib/nativeAtomicStorage': await fs.readFile('tgcloud/lib/nativeAtomicStorage.js', 'utf8'),
    'endpoints/concurrencyCheck': `import {db} from 'sdk';
      import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
      export default async function(input) {
        if (!/^test:concurrency:[a-f0-9-]{36}$/.test(input.key)) throw new Error('Invalid test key.');
        if(input.seed) {await db.run('INSERT INTO game_atomic_documents(id,revision,document) VALUES(:id,0,:document) ON CONFLICT(id) DO NOTHING',{':id':input.key,':document':JSON.stringify({counter:0,receipts:{}})});return {seeded:true};}
        if(input.read) {const {state}=await nativeTransactions.read(input.key);return {counter:state.counter,receipts:Object.keys(state.receipts).length};}
        try {const result=await nativeTransactions.transact(input.key,{id:input.operation,fingerprint:'increment'},state=>({counter:++state.counter}));return {committed:true,replayed:result.replayed};}
        catch(error) {return {committed:false,code:error.code||error.name};}
      }`};
  const token = await resolveToken(), key = 'test:concurrency:' + randomUUID();
  const invoke = async input => (await runFunction(token, 'endpoints/concurrencyCheck', sources, {key, ...input}, {})).result;
  await invoke({seed: true});
  const operations = Array.from({length: 13}, () => randomUUID());
  const first = await Promise.all(operations.map(operation => invoke({operation})));
  // Unknown outcomes are retried with their original ID, as the game client does.
  const retries = await Promise.all(operations.map(operation => invoke({operation})));
  const result = await invoke({read: true});
  console.log(JSON.stringify({concurrent: 13, firstCommitted: first.filter(row => row.committed).length,
    retryCommitted: retries.filter(row => row.committed).length, ...result}));
  if (result.counter !== 13 || result.receipts !== 13 || retries.some(row => !row.committed)) process.exitCode = 1;
} catch (error) {console.error('Native concurrency check failed:', error.status || error.code || error.name || 'UNKNOWN'); process.exitCode = 1;}
