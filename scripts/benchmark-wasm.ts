import fs from 'node:fs/promises';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import {calculateTypedDamage} from '../src/utils/typedDamage';
import {packCombatBatch,createCombatCalculator} from '../src/wasm/combatEngine';
import {combatInputs} from '../tests/helpers/combatInputs';
import init,* as wasm from '../src/wasm/generated/aethelgard_engine.js';
const binary=await fs.readFile('src/wasm/generated/aethelgard_engine_bg.wasm');
const start=performance.now(),module=await init({module_or_path:binary}),initMs=performance.now()-start;
const memoryBefore=module.memory.buffer.byteLength;
let sink:unknown;
async function time(work:()=>unknown,iterations:number){
 for(let i=0;i<30;i++)sink=await work();
 const samples=[];
 for(let sample=0;sample<9;sample++){
  const begin=performance.now();for(let i=0;i<iterations;i++)sink=await work();
  samples.push((performance.now()-begin)*1000/iterations);
 }
 samples.sort((a,b)=>a-b);return {medianUs:samples[4],p95Us:samples[8]};
}
const rows=[];
for(const [size,iterations]of [[1,10000],[32,1000],[512,100],[4096,20]]){
 const hits=combatInputs(size),packed=packCombatBatch(hits),calculator=createCombatCalculator({enabled:true,load:async()=>wasm});
 const ts=await time(()=>Float64Array.from(hits,calculateTypedDamage),iterations);
 const wasmPrepared=await time(()=>wasm.typed_damage_batch(packed),iterations);
 const wasmWithPacking=await time(()=>wasm.typed_damage_batch(packCombatBatch(hits)),iterations);
 const wasmSafeAdapter=await time(()=>calculator(hits),iterations);
 rows.push({size,iterations,ts,wasmPrepared,wasmWithPacking,wasmSafeAdapter,fullAdapterSpeedup:ts.medianUs/wasmSafeAdapter.medianUs});
}
const report={version:1,at:new Date().toISOString(),node:process.version,cpu:os.cpus()[0].model,initMs,wasmBytes:binary.length,wasmGzipBytes:gzipSync(binary).length,
 memoryBefore,memoryAfter:module.memory.buffer.byteLength,rows,
 note:'Local Node/V8 synthetic benchmark, not mobile FPS or network latency. Prepared-array speed excludes object conversion. Use full adapter cost for adoption decisions.'};
if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));void sink;
