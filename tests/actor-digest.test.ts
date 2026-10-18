import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createActorDigest} from '../server/actorDigest';
const callback=Symbol('fixture');
function legacy(value:any):string{
 const normalize=(item:any):any=>typeof item==='function'?item[callback]||'[function]':item instanceof Set?[...item].map(normalize):Array.isArray(item)?item.map(normalize):item&&typeof item==='object'?Object.fromEntries(Object.keys(item).sort().map(key=>[key,normalize(item[key])])):item;
 return JSON.stringify(normalize(value))??'[undefined]';
}
test('actor dependency bytes and SHA-256 remain compatible with saved legacy effects',()=>{
 const tagged=()=>{};Object.defineProperty(tagged,callback,{value:'setter:player'});
 const shared={inventory:[{name:'Щит 🛡️',stats:{attack:3},missing:undefined}],neg:-0};
 const values:any[]=[undefined,null,NaN,Infinity,-Infinity,-0,1.5,Symbol('a'),'\ud800',tagged,()=>{},new Set([1,undefined,tagged]),new Map([[1,2]]),new Date(0),Array(3),{10:'ten',2:'two','01':'other',z:shared,a:shared,unset:undefined,fn:tagged}];
 const proto=Object.create(null);proto.__proto__={b:2,a:1};values.push(proto);
 let seed=19;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<2000;i++)values.push({['k'+next()%50]:[next()/3,shared,'\n'+next(),undefined],numbers:{100:next(),2:next()},ordered:new Set([next(),next()])});
 const digest=createActorDigest(callback);digest.beginRead();
 for(const value of values){const text=legacy(value);assert.equal(digest.text(value),text);assert.equal(digest.digest(value),crypto.createHash('sha256').update(text).digest('hex'));}
 digest.endRead();assert.throws(()=>digest.text(1n));const cycle:any={};cycle.self=cycle;assert.throws(()=>digest.text(cycle));
});
test('read caches never survive effect/action mutation or the next render',()=>{
 const digest=createActorDigest(callback),value={hp:10};digest.beginRead();const first=digest.digest(value);
 digest.endRead();value.hp=5;assert.notEqual(digest.digest(value),first);
 digest.beginRead();assert.equal(digest.text(value),legacy(value));digest.endRead();
});
