// Explicit read-only synthetic /run probes. Never deploys, reads player data,
// sends messages, or writes storage. Run perf:actor first to build both variants.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveToken} from '../node_modules/@tgcloud/cli/src/core/credentials.js';
import {runFunction} from '../node_modules/@tgcloud/cli/src/api/endpoints.js';
process.env.TGCLOUD_DEBUG='false';
const sources={};
async function collect(directory,prefix=''){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  if(entry.name.startsWith('.'))continue;
  const filename=path.join(directory,entry.name),name=prefix+entry.name;
  if(entry.isDirectory())await collect(filename,name+'/');
  else if(entry.name.endsWith('.js'))sources[name.slice(0,-3)]=await fs.readFile(filename,'utf8');
 }
}
await collect('tgcloud');sources['endpoints/nativeCheck']=await fs.readFile('scripts/staging/benchmarkActor.js','utf8');
const baseline=await import(pathToFileURL(path.resolve('.migration-backups/stage2-native/typescript.mjs')).href);
const config={user:{id:9701,first_name:'Synthetic'},locale:'ru',resetVersion:0,admin:false,premium:{active:true,premiumUntil:'2030-01-01T00:00:00.000Z',priceStars:150,periodDays:30},now:()=>1800000000000};
const seed=await new baseline.GameActor(config).initialize();await seed.invoke('createCharacter','Synthetic','warrior',true);const snapshot=seed.snapshot();
const token=await resolveToken(),rows=[];
for(const iterations of [1,12])for(let sample=0;sample<3;sample++)for(const name of sample%2?['rust','typescript']:['typescript','rust']){
 sources['lib/gameEngine']=await fs.readFile('.migration-backups/stage2-native/'+name+'.mjs','utf8');
 const response=await runFunction(token,'endpoints/nativeCheck',sources,{snapshot,iterations},{});
 if(!response.result.timerCompatible)throw new Error('Timer compatibility failed');
 if(response.result.hashMode!==(name==='rust'?'rust':'typescript'))throw new Error('Unexpected fingerprint backend');
 rows.push({name,iterations,sample,runtimeMs:response.time*1000,clockAvailable:response.result.clockAvailable,hashMode:response.result.hashMode});
}
const summary=[];
for(const iterations of [1,12])for(const name of ['typescript','rust']){
 const samples=rows.filter(row=>row.iterations===iterations&&row.name===name).map(row=>row.runtimeMs).sort((a,b)=>a-b);
 summary.push({name,iterations,medianMs:samples[1],minMs:samples[0],maxMs:samples[2]});
}
const report={version:1,at:new Date().toISOString(),rows,summary,note:'Synthetic /run invocation, metadata time in seconds converted to ms. Includes cold module/WASM initialization. No DB, network game transport or physical phone FPS. V8 Date.now is fixed and performance is unavailable; internal zero durations are not measurements.'};
const output=process.argv[2]||'.migration-backups/stage2-telegram-full.json';await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
