import {build} from 'esbuild';
import {parseSync} from 'rolldown/utils';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
export async function buildGameEngine({allowSourceAssets = false} = {}) {
  const manifest = await fs.readFile(path.join(root, 'dist/.vite/manifest.json'), 'utf8').then(JSON.parse).catch(() => ({}));
  await build({entryPoints: ['src/game/actorEntry.ts'], outfile: 'server-dist/game-engine.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'external',
    define: {'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""'},
    plugins: [{name: 'account-game-actor', setup(builder) {
      builder.onLoad({filter: /GameContext\.tsx$/}, async ({path: filename}) => {
        const source = await fs.readFile(filename, 'utf8'), parsed = parseSync(filename, source), edits = [];
        if (parsed.errors.length) throw new Error('Cannot parse shared game engine: ' + JSON.stringify(parsed.errors));
        function walk(node, parent) {
          if (!node || typeof node !== 'object') return;
          if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && ['useState', 'useRef', 'useEffect', 'useCallback', 'useMemo'].includes(node.callee.name)) {
            let key;
            if (node.callee.name === 'useEffect') {
              const comment = parsed.comments.findLast(c => c.end <= node.start && /^\s*$/.test(source.slice(c.end, node.start)));
              key = comment && /@actor-effect\s+([^\s*]+)/.exec(comment.value)?.[1];
              key = key ? 'actor:' + key : 'client-only:' + node.start;
            } else {
              if (parent?.type !== 'VariableDeclarator') throw new Error('Actor state needs a stable variable name.');
              key = parent.id.type === 'ArrayPattern' ? parent.id.elements.find(Boolean)?.name : parent.id.name;
              if (!key) throw new Error('Missing actor state identifier.');
            }
            const arity = ['useEffect', 'useCallback', 'useMemo'].includes(node.callee.name) ? 2 : 1;
            const extra = [...Array(Math.max(0, arity - node.arguments.length)).fill('undefined'), JSON.stringify(key)];
            edits.push({at: node.end - 1, text: (node.arguments.length ? ', ' : '') + extra.join(', ')});
          }
          for (const [key, value] of Object.entries(node)) if (key !== 'parent') {
            if (Array.isArray(value)) value.forEach(child => walk(child, node));
            else if (value && typeof value === 'object') walk(value, node);
          }
        }
        walk(parsed.program, null);
        let contents = source;
        for (const edit of edits.sort((a, b) => b.at - a.at)) contents = contents.slice(0, edit.at) + edit.text + contents.slice(edit.at);
        return {contents, loader: 'tsx'};
      });
      builder.onLoad({filter: /\.(jpg|jpeg|png|webp|svg)$/}, async ({path: filename}) => {
        const relative = path.relative(root, filename).split(path.sep).join('/');
        const url = manifest[relative]?.file ? '/' + manifest[relative].file : allowSourceAssets ? '/' + relative : null;
        if (!url) throw new Error('Asset absent from production manifest: ' + relative);
        return {contents: 'export default ' + JSON.stringify(url), loader: 'js'};
      });
    }}], logLevel: 'silent'});
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await buildGameEngine({allowSourceAssets: process.argv.includes('--allow-source-assets')});
