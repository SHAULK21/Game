import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createActorTextHasher} from '../server/native/actorHash';
test('Rust actor hashes exactly match Node SHA-256 across Unicode, block boundaries and large states',()=>{
 const hasher=createActorTextHasher({enabled:true,threshold:0});
 for(const size of [0,1,55,56,63,64,65,127,128,129,4095,4096,16384,131072]){
  for(const text of ['x'.repeat(size),'Щит 🛡️\ud800\n'.repeat(size)])assert.equal(hasher.hash(text),crypto.createHash('sha256').update(text).digest('hex'));
 }
 assert.equal(hasher.mode(),'rust');
});
test('unavailable, mismatched or trapping WASM falls back once without changing fingerprints',()=>{
 for(const load of [()=>{throw new Error('disabled runtime');},()=>({actor_sha256:()=>new Uint8Array(32)})]){
  let attempts=0;const hasher=createActorTextHasher({enabled:true,threshold:0,load:()=>{attempts++;return load();}});
  for(let i=0;i<3;i++)assert.equal(hasher.hash('value'),crypto.createHash('sha256').update('value').digest('hex'));
  assert.equal(attempts,1);assert.equal(hasher.mode(),'fallback');
 }
 const short=createActorTextHasher({enabled:true,load:()=>{throw new Error('must not initialize');}});
 short.hash('small');assert.equal(short.mode(),'uninitialized');
 let calls=0;const trap=createActorTextHasher({enabled:true,threshold:0,load:()=>({actor_sha256:input=>{
  if(calls++)throw new Error('runtime trap');return new Uint8Array(crypto.createHash('sha256').update(input).digest());
 }})});
 assert.equal(trap.hash('value'),crypto.createHash('sha256').update('value').digest('hex'));assert.equal(trap.mode(),'fallback');
});
