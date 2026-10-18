import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../src/utils/canonicalJson';
import {meaningfulSave} from '../server/saveFingerprint';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
test('save comparison ignores only travel progress and never mutates source branches',()=>{
 for(const traveling of [true,false]){
  const save:any={player:{gold:120},actor:{version:1,state:{travelState:{isTraveling:traveling,progress:42,arrivesAt:1000},pendingReward:{gold:15}},refs:{},effects:{},timers:{}}};
  const before=JSON.stringify(save),legacy=structuredClone(save);if(traveling)legacy.actor.state.travelState.progress=0;
  assert.equal(meaningfulSave(save),canonicalJson(legacy));assert.equal(JSON.stringify(save),before);
  const changed=structuredClone(save);changed.actor.state.pendingReward.gold++;
  assert.notEqual(meaningfulSave(save),meaningfulSave(changed));
 }
});
test('unchanged inventory avoids SQL rewrites; lock changes and operation replay retain ownership',async()=>{
 const native=new NativePool({tables:{}}),identity={id:9651,displayName:'Save test'};native.ensurePlayer(identity);
 const base=native.asPool(),statements:string[]=[];
 const tracked={...base,connect:async()=>{const client=await base.connect();return {query:async(sql:any,...args:any[])=>{statements.push(String(sql));return (client.query as any)(sql,...args);},release:()=>client.release()};}} as any;
 const store=new GameStore(tracked),token=crypto.randomUUID();let current=await store.acquire(identity,token,0,false);
 const op=()=>({sessionToken:token,operationId:crypto.randomUUID(),expectedVersion:current.version,resetVersion:current.resetVersion,sessionGeneration:current.sessionGeneration});
 current=await store.create(identity,op(),{name:'Save test',classId:'warrior'});
 const owned=structuredClone(current.game!.player!.inventory);assert.ok(owned.length);
 statements.length=0;current=await store.operation(identity,op(),{type:'dismissFlightWarning'});
 assert.equal(statements.filter(sql=>/^(?:UPDATE|INSERT INTO|DELETE FROM) owned_items/.test(sql)).length,0);
 assert.deepEqual(current.game!.player!.inventory,owned);
 const itemId=owned[0].id,operation=op();statements.length=0;
 current=await store.operation(identity,operation,{type:'toggleItemLock',itemId});
 assert.ok(statements.some(sql=>sql.startsWith('UPDATE owned_items')));
 assert.equal(current.game!.player!.inventory.find(i=>i.id===itemId)!.isLocked,true);
 const replay=await store.operation(identity,operation,{type:'toggleItemLock',itemId});
 assert.equal(replay.operation.replayed,true);assert.equal(replay.game!.player!.inventory.find(i=>i.id===itemId)!.isLocked,true);
});
