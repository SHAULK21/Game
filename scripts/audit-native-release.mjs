import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
const root = path.resolve('tgcloud');
const allowed = new Set(['schema.js', 'endpoints/gameApi.js', 'handlers/message.js', 'handlers/pre_checkout_query.js',
  'lib/atomicDocument.js', 'lib/nativeAtomicStorage.js', 'lib/gameEngine.js', 'lib/native-uk.js', 'lib/deliveryWorker.js']);
const found = new Set();
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {await inspect(filename); continue;}
    const relative = path.relative(root, filename).replaceAll('\\', '/');
    assert.ok(allowed.has(relative), 'Unexpected deployable file: ' + relative); found.add(relative);
    const source = await fs.readFile(filename, 'utf8');
    assert.ok(Buffer.byteLength(source) <= 1048576, 'Module exceeds 1 MiB: ' + relative);
    await transform(source, {loader: 'js', format: 'esm', target: 'es2022'});
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier === 'sdk' || specifier === 'sdk/db') continue;
      assert.ok(specifier.startsWith('.') && specifier.endsWith('.js'), 'Unsupported native import in ' + relative + ': ' + specifier);
      const target = path.resolve(path.dirname(filename), specifier);
      assert.ok(target.startsWith(root + path.sep), 'Import escapes module root.');
      await fs.access(target);
    }
    assert.ok(!/\b(?:process\.env|require\s*\()|(?<!\.)\bsetInterval\s*\(/.test(source), 'Unsupported runtime construct: ' + relative);
  }
}
await inspect(root);
assert.deepEqual(found, allowed, 'Required native module missing. Run build:telegram.');
assert.deepEqual((await fs.readdir('tgcloud/endpoints')).sort(), ['gameApi.js'], 'Diagnostic endpoints must never be published.');
const config = JSON.parse(await fs.readFile('tgcloud.jsonc', 'utf8'));
assert.equal(config.static.source, 'dist');
await fs.access('dist/index.html');
const frontend = (await fs.readdir('dist/assets')).filter(file => file.endsWith('.js'));
let nativeTransport = false;
for (const filename of frontend) {
  const source = await fs.readFile('dist/assets/' + filename, 'utf8');
  if (source.includes('Serverless') && source.includes('gameApi')) nativeTransport = true;
}
assert.ok(nativeTransport, 'Build frontend with VITE_GAME_BACKEND=telegram.');
console.log(JSON.stringify({ready: true, modules: found.size, endpoints: ['gameApi'], transport: 'Telegram.WebApp.Serverless.call', note: 'Local release checks. Production data and webhook must be verified separately.'}));
