import {buildGameEngine} from './build-game-engine.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const cryptoShim = path.resolve('server/native/crypto.ts');
// Measured on Telegram /run, including cold initialization. Set ACTOR_WASM=0
// to build the byte-compatible JS fallback without embedding the WASM module.
const actorWasm=process.env.ACTOR_WASM!=='0';
const output=process.env.NATIVE_ENGINE_OUTPUT||'tgcloud/lib/gameEngine.js';
await fs.writeFile('tgcloud/lib/native-uk.js', 'export default ' + await fs.readFile('src/i18n/uk.json', 'utf8') + ';\n');
await buildGameEngine({buildOptions: {entryPoints: ['server/native/engineEntry.ts'], outfile: output,
  bundle: true, packages: 'bundle', platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  define: {'process.env.NODE_ENV': '"production"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""','__ACTOR_WASM_HASH__':String(actorWasm)},
  plugins: [{name: 'telegram-native-engine', setup(builder) {
    builder.onResolve({filter: /^node:crypto$/}, () => ({path: cryptoShim}));
    builder.onResolve({filter: /(?:^|\/)actorHash$/}, args=>({path:path.resolve(actorWasm?'server/native/actorHash.ts':'server/actorHash.ts')}));
    builder.onResolve({filter: /[/\\]uk\.json$/}, () => ({path: './native-uk.js', external: true}));
    builder.onLoad({filter: /[/\\]gameTransactions\.ts$/}, async () => ({
      contents: await fs.readFile('server/native/transactions.ts', 'utf8'), loader: 'ts', resolveDir: path.resolve('server/native'),
    }));
    builder.onLoad({filter: /[/\\]gameActor\.ts$/}, async ({path: filename}) => {
      let contents = await fs.readFile(filename, 'utf8');
      const before = /let enginePromise: Promise<EngineModule> \| undefined;\s*export const loadGameEngine = [^\n]+;/;
      if (!before.test(contents)) throw new Error('GameActor loader changed; review the native build adapter.');
      contents = contents.replace(before, `import * as nativeEngine from '../src/game/actorEntry.ts';\nexport const loadGameEngine = () => Promise.resolve(nativeEngine);`);
      return {contents, loader: 'ts'};
    });
  }}]}});
for (const filename of [output,'tgcloud/lib/native-uk.js']) {
  const bytes = (await fs.stat(filename)).size;
  if (bytes > 1048576) throw new Error('Telegram module exceeds 1 MiB: ' + filename);
  console.log(filename + ': ' + bytes + ' bytes');
}
