import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json','utf8'));
const engine='src/context/GameContext.tsx';
assert(manifest[engine]?.isDynamicEntry,'Local engine must remain a separate dynamic entry');
function closure(key,seen=new Set()){
 if(seen.has(key))return seen;
 seen.add(key);for(const child of manifest[key]?.imports||[])closure(child,seen);
 return seen;
}
const initial=closure('index.html');
assert(!initial.has(engine),'Telegram startup must not load the local simulation');
const modes=['modern','fantasy','fantasy-beta'];
for(const mode of modes){
 const loaded=closure('src/interfaces/'+mode+'/entry.tsx');
 assert(!loaded.has(engine),'Interface must not pull in the local simulation: '+mode);
 for(const other of modes.filter(other=>other!==mode))assert(!loaded.has('src/interfaces/'+other+'/entry.tsx'),'Foreign interface loaded');
}
// Pilot stays out of the production graph until full adapter and device benchmarks justify it.
assert(!Object.keys(manifest).some(key=>key.includes('/wasm/')),'Unapproved WASM entered production');
const initialBytes=(await Promise.all([...initial].map(async key=>(await fs.stat('dist/'+manifest[key].file)).size))).reduce((a,b)=>a+b,0);
assert(initialBytes<900000,'Startup JavaScript exceeds the post-split 900 KB budget');
console.log(JSON.stringify({ready:true,initialBytes,localEngine:'lazy',wasm:'pilot-only',interfaces:modes}));
