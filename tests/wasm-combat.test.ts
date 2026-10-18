import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createCombatCalculator,packCombatBatch} from '../src/wasm/combatEngine';
import {calculateTypedDamage} from '../src/utils/typedDamage';
import {combatInputs} from './helpers/combatInputs';
import init,* as wasm from '../src/wasm/generated/aethelgard_engine.js';
const ready=init({module_or_path:await fs.readFile('src/wasm/generated/aethelgard_engine_bg.wasm')});

test('compiled Rust matches the TypeScript oracle for 20,000 seeded physical/elemental/true hits',async()=>{
 await ready;assert.equal(wasm.protocol_version(),1);
 const inputs=combatInputs(20000);
 for(let offset=0;offset<inputs.length;offset+=4096){
  const batch=inputs.slice(offset,offset+4096);
  assert.deepEqual([...wasm.typed_damage_batch(packCombatBatch(batch))],batch.map(calculateTypedDamage));
 }
});
test('Rust boundaries, rounding, malformed lengths and non-finite values',async()=>{
 await ready;
 const hits=combatInputs(9).flatMap(hit=>[-75,0,85,1000,-1000].map(resistance=>({...hit,power:2.5,multiplier:1,targetDefense:0,targetMagicDefense:0,armorPenetration:0,extraDamageMultiplier:1,targetResistances:{[hit.damageType]:resistance}})));
 assert.deepEqual([...wasm.typed_damage_batch(packCombatBatch(hits))],hits.map(calculateTypedDamage));
 for(const input of [new Float64Array(7),new Float64Array(4097*8),new Float64Array([1,NaN,1,0,0,0,0,1]),new Float64Array([3,1,1,0,0,0,0,1]),new Float64Array([1,Infinity,1,0,0,0,0,1]),new Float64Array([0,1e12,1e12,0,0,0,0,1])])assert.throws(()=>wasm.typed_damage_batch(input));
});
test('disabled pilot never loads WASM; failed, incompatible or stalled initialization uses TS',async()=>{
 const hits=combatInputs(3),expected=hits.map(calculateTypedDamage);
 const disabled=createCombatCalculator({load:async()=>{throw new Error('must not load');}});
 assert.deepEqual([...await disabled(hits)],expected);
 for(const load of [()=>{throw new Error('network');},async()=>({protocol_version:()=>2,typed_damage_batch:()=>new Float64Array()}),async()=>new Promise<never>(()=>{})]){
  let attempts=0;const calc=createCombatCalculator({enabled:true,load:async()=>{attempts++;return load();},initTimeoutMs:5});
  assert.deepEqual([...await calc(hits)],expected);assert.deepEqual([...await calc(hits)],expected);assert.equal(attempts,1);
 }
});
test('loader is coalesced, invalid results fall back, and pending inputs cannot be changed by callers',async()=>{
 await ready;let attempts=0;
 const calc=createCombatCalculator({enabled:true,load:async()=>{attempts++;return wasm;}}),hits=combatInputs(20),expected=hits.map(calculateTypedDamage);
 const first=calc(hits),second=calc(hits);hits[0].power=0;
 assert.deepEqual([...await first],expected);assert.deepEqual([...await second],expected);assert.equal(attempts,1);
 for(const output of [new Float64Array(0),new Float64Array([Infinity]),new Float64Array([1.5])]){
  const bad=createCombatCalculator({enabled:true,load:async()=>({protocol_version:()=>1,typed_damage_batch:()=>output})});
  assert.deepEqual([...await bad(hits)],hits.map(calculateTypedDamage));
 }
 await assert.rejects(()=>calc([{...hits[0],power:NaN}]));
 await assert.rejects(()=>calc(Array(4097).fill(hits[0])));
});
