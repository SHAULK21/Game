import fs from 'node:fs/promises';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import {GameActor} from '../server/gameActor';
import {incomingAttackRoll} from '../src/utils/combatBonuses';
import {getEffectiveGearStats} from '../src/utils/classEquipment';
import {selectBulkItems} from '../src/utils/bulkInventory';
import {getNextExperience} from '../src/utils/progression';
import {simulateDuel} from '../src/utils/pvp';

// Synthetic data only. No network, live accounts, storage writes, or rewards.
const config={user:{id:900001,first_name:'Benchmark'},locale:'ru' as const,resetVersion:0,admin:false,
 premium:{active:false,premiumUntil:null,priceStars:150,periodDays:30},now:()=>1_800_000_000_000};
const actor=await new GameActor(config).initialize();await actor.invoke('createCharacter','Benchmark','warrior',true);
const snapshot=actor.snapshot(),player=actor.current.player!;
const item={id:'bench',templateId:'bench',icon:'',sellPrice:0,disassembleYield:{},name:'Боевой меч',type:'weapon' as const,rarity:'common' as const,level:40,upgradeLevel:12,stats:{attack:200,strength:30},baseAttack:200};
const inventory=Array.from({length:500},(_,i)=>({...item,id:'bench'+i,level:i%100,rarity:i%2?'rare' as const:'common' as const}));
let sink:unknown;
async function bench(name:string,count:number,work:(index:number)=>unknown|Promise<unknown>){
 for(let i=0;i<Math.min(count,30);i++)sink=await work(i);
 const samples:number[]=[],cpu:number[]=[];
 for(let sample=0;sample<9;sample++){
  const used=process.cpuUsage(),start=performance.now();
  for(let i=0;i<count;i++)sink=await work(i);
  samples.push((performance.now()-start)*1000/count);
  const delta=process.cpuUsage(used);cpu.push((delta.user+delta.system)/count);
 }
 samples.sort((a,b)=>a-b);cpu.sort((a,b)=>a-b);
 return {name,iterations:count,samples:9,medianUs:samples[4],p95Us:samples[8],cpuMedianUs:cpu[4]};
}
const before=process.memoryUsage();
const measurements=[];
measurements.push(await bench('incomingAttackRoll',10000,i=>incomingAttackRoll(100+i%100,25,20,()=>0.4)));
measurements.push(await bench('equipmentStats',5000,()=>getEffectiveGearStats(item,'warrior')));
measurements.push(await bench('experienceFormula',10000,i=>getNextExperience(1+i%100)));
measurements.push(await bench('inventoryFilter500',500,()=>selectBulkItems({...player,inventory},{rarities:['common'],type:'all',keepUpgraded:false})));
measurements.push(await bench('pvpDuelWithLog',500,()=>simulateDuel({classId:'warrior',stance:'balanced',name:'A'},{classId:'mage',stance:'guard',name:'B'},()=>0.4)));
measurements.push(await bench('actorRehydrate',40,()=>new GameActor({...config,snapshot}).initialize()));
measurements.push(await bench('actorProjection',100,()=>actor.publicView()));
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json','utf8'));
function closure(key:string,seen=new Set<string>()){
 if(seen.has(key))return seen;seen.add(key);for(const dependency of manifest[key]?.imports||[])closure(dependency,seen);return seen;
}
async function bundle(keys:Set<string>){
 const files=[...new Set([...keys].flatMap(k=>[manifest[k]?.file,...(manifest[k]?.css||[])]).filter(Boolean))];
 const result={jsBytes:0,jsGzipBytes:0,cssBytes:0,files};
 for(const name of files){const data=await fs.readFile('dist/'+name);if(name.endsWith('.js')){result.jsBytes+=data.length;result.jsGzipBytes+=gzipSync(data).length;}else if(name.endsWith('.css'))result.cssBytes+=data.length;}
 return result;
}
const entry=await bundle(closure('index.html'));
const interfaces=Object.fromEntries(await Promise.all(['modern','fantasy','fantasy-beta'].map(async style=>[style,await bundle(closure('src/interfaces/'+style+'/entry.tsx'))])));
const js=Object.values(manifest).filter((m:any)=>m.file.endsWith('.js')) as any[];
const totalJsBytes=(await Promise.all([...new Set(js.map(m=>m.file))].map(async file=>(await fs.stat('dist/'+file)).size))).reduce((a,b)=>a+b,0);
const report={version:1,commit:process.env.PROFILE_COMMIT||null,at:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model},
 notes:['Local Node measurements on synthetic data; not Telegram network latency or mobile FPS.','Async harness overhead is included; sub-microsecond timings are not a WASM justification.','Bundle bytes are static import closures, excluding optional screens, images and remote SDK.'],
 measurements,memory:{before,after:process.memoryUsage()},bundle:{entry,interfaces,totalJsBytes}};
const output=process.argv[2];if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));void sink;
