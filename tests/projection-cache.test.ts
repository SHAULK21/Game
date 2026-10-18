import test from 'node:test';
import assert from 'node:assert/strict';
import {ServerProgress} from '../src/utils/serverProgress';
import {serializeProjectionCache} from '../src/utils/projectionCache';
import {expandGameReply} from '../src/utils/gameProjection';
import type {ProgressEnvelope} from '../src/types/progress';
function fixture(){
 const data=new Map<string,string>(),writes:string[]=[],scheduled=new Map<number,()=>void>();let id=0;
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);writes.push(key);},removeItem:(key:string)=>data.delete(key)};
 const client=new ServerProgress('1',crypto.randomUUID(),storage,async()=>{throw new Error('offline');},work=>{const key=++id;scheduled.set(key,work);return()=>{scheduled.delete(key);};});
 const flush=()=>{for(const work of scheduled.values())work();scheduled.clear();};
 return {client,data,writes,scheduled,flush};
}
function envelope(version:number,resetVersion=0):ProgressEnvelope{
 const player={userId:'1',gold:120,inventory:Array.from({length:100},(_,i)=>({id:String(i),name:'Shield'}))},quests:any[]=[],achievements:any[]=[];
 return {protocol:'server-actions-v1',ownerId:'1',version,resetVersion,sessionGeneration:1,activeHere:true,writerPresent:true,migrationOpen:false,canonical:true,
  save:{player,quests,achievements,activeDungeonRun:null},game:{player,quests,achievements,activeDungeonRun:null},expeditions:null,serverTime:Date.now(),nextTickAt:null,cues:[]} as any;
}
test('unchanged polls do not serialize/write caches; new versions coalesce outside the action path',()=>{
 const f=fixture();f.client.accept(envelope(1));f.client.accept(envelope(1));assert.equal(f.writes.length,0);assert.equal(f.scheduled.size,1);
 f.client.accept(envelope(2));assert.equal(f.scheduled.size,1);f.flush();assert.equal(f.writes.length,1);
 const cache=JSON.parse(f.data.get('aethelgard_server_cache_1_0')!);assert.equal(cache.reply.body.version,2);
 f.client.accept(envelope(2));f.flush();assert.equal(f.writes.length,1);
 f.client.accept(envelope(3));f.client.disposeCache();assert.equal(f.scheduled.size,0);
});
test('pending paid action is written immediately even with deferred caches and lost responses',async()=>{
 const f=fixture();f.client.accept(envelope(1));await assert.rejects(()=>f.client.mutate('/api/progress/command',{type:'drinkBeer'}));
 assert.ok(f.data.get('aethelgard_server_pending_1'));assert.ok(f.client.pending);assert.equal(f.writes.filter(key=>key.includes('_cache_')).length,0);
 f.client.accept(envelope(0,1));f.flush();assert.equal(f.client.pending,null);assert.equal(f.data.has('aethelgard_server_pending_1'),false);
 assert.equal(f.data.has('aethelgard_server_cache_1_0'),false,'cancel pre-reset cache');
});
test('compact optional cache is smaller and expands back to the confirmed projection',()=>{
 const snapshot=envelope(1),encoded=serializeProjectionCache(snapshot),cache=JSON.parse(encoded);
 assert.ok(encoded.length<JSON.stringify(snapshot).length*.7);
 assert.deepEqual(expandGameReply(cache.reply).body,snapshot);
});
