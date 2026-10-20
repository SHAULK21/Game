import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await fs.readFile('dist/flutter-inventory.json','utf8'));
assert.equal(manifest.protocol,1);assert.match(manifest.version,/^[a-f0-9]{12}$/);assert.equal(manifest.baseUrl,`/flutter-inventory/${manifest.version}/`);
const root=path.join('dist',manifest.baseUrl),boot=await fs.readFile(path.join(root,'flutter_bootstrap.js'),'utf8');
assert(boot.includes('multiViewEnabled: true'));assert(boot.includes("canvasKitBaseUrl: root + 'canvaskit/'"));assert(!boot.slice(boot.lastIndexOf('_flutter.loader.load(')).includes('serviceWorkerSettings'));
const dart=await fs.readFile(path.join(root,'main.dart.js'),'utf8');assert(dart.includes('aethelgardInventoryUpdate'));assert(dart.includes('aethelgardInventoryAction'));
for(const variant of ['','chromium/']){const wasm=await fs.readFile(path.join(root,'canvaskit',variant,'canvaskit.wasm'));assert.equal(wasm.subarray(0,4).toString('hex'),'0061736d');}
for(const font of ['NotoSans-Regular.ttf','NotoSansSymbols2-Regular.ttf'])assert((await fs.stat(path.join(root,'assets/assets',font))).size>10000);
const html=await fs.readFile('dist/index.html','utf8');assert(!html.includes('flutter_bootstrap'),'Flutter must not enter initial page load');
console.log(JSON.stringify({ready:true,flutter:manifest.flutterVersion,version:manifest.version,renderers:'local CanvasKit + Chromium fallback',startup:'lazy',fonts:'local Cyrillic + symbols'}));
