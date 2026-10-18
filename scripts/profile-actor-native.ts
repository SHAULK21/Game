import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const directory=path.resolve('.migration-backups/stage2-native');await fs.mkdir(directory,{recursive:true});
const modules:any[]=[];
for(const enabled of [false,true]){
 const output=path.join(directory,enabled?'rust.mjs':'typescript.mjs');
 execFileSync(process.execPath,['scripts/build-native-engine.mjs'],{env:{...process.env,ACTOR_WASM:enabled?'1':'0',NATIVE_ENGINE_OUTPUT:output},stdio:'pipe'});
 await fs.copyFile('tgcloud/lib/native-uk.js',path.join(directory,'native-uk.js'));
 modules.push({enabled,output,module:await import(pathToFileURL(output).href),bytes:(await fs.stat(output)).size});
}
await fs.copyFile('tgcloud/lib/native-uk.js',path.join(directory,'native-uk.js'));
const config={user:{id:9701,first_name:'Benchmark'},locale:'ru',resetVersion:0,admin:false,premium:{active:true,premiumUntil:'2030-01-01T00:00:00.000Z',priceStars:150,periodDays:30},now:()=>1_800_000_000_000};
// Identical persisted snapshot, including effect digests, for both engines.
const seed=await new modules[0].module.GameActor(config).initialize();await seed.invoke('createCharacter','Benchmark','warrior',true);const snapshot=seed.snapshot();
const rows=[];
for(const variant of modules){
 const begin=performance.now();const actor=await new variant.module.GameActor({...config,snapshot}).initialize();const firstMs=performance.now()-begin;
 const samples=[];
 for(let sample=0;sample<9;sample++){
  const start=performance.now();for(let i=0;i<40;i++)await new variant.module.GameActor({...config,snapshot}).initialize();samples.push((performance.now()-start)/40);
 }
 samples.sort((a,b)=>a-b);
 rows.push({rust:variant.enabled,moduleBytes:variant.bytes,firstMs,medianMs:samples[4],p95Ms:samples[8],effectsEqual:JSON.stringify(actor.snapshot().effects)===JSON.stringify(seed.snapshot().effects),timersEqual:JSON.stringify(actor.snapshot().timers)===JSON.stringify(seed.snapshot().timers)});
}
const report={version:1,node:process.version,at:new Date().toISOString(),rows,note:'Same synthetic actor snapshot, native crypto shim and 9x40 iterations. Node V8, not Telegram network latency. firstMs includes lazy WASM setup.'};
const output=process.argv[2];if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
