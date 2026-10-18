import {hashActorText} from './actorHash';

/** Exact legacy normalize -> JSON.stringify bytes, with reusable subtrees during
 * one synchronous render read. Never cache across effects, setters or requests. */
export function createActorDigest(callback: symbol){
 let cache:WeakMap<object,string>|undefined;
 const encode=(item:any,seen=new Set<object>()):string|undefined=>{
  if(typeof item==='function')return JSON.stringify(item[callback]||'[function]');
  if(!item||typeof item!=='object')return JSON.stringify(item);
  const hit=cache?.get(item);if(hit!==undefined)return hit;
  if(seen.has(item))throw new TypeError('Cyclic actor dependency');
  seen.add(item);
  let value:string;
  if(Array.isArray(item)||item instanceof Set){
   // Array holes/undefined/symbols use JSON's null placeholders.
   const entries=Array.isArray(item)?Array.from({length:item.length},(_,i)=>item[i]):[...item];
   value='['+entries.map(entry=>encode(entry,seen)??'null').join(',')+']';
  }else{
   const indices:string[]=[],names:string[]=[];
   for(const key of Object.keys(item)){
    const n=Number(key);(Number.isInteger(n)&&n>=0&&n<4294967295&&String(n)===key?indices:names).push(key);
   }
   indices.sort((a,b)=>Number(a)-Number(b));names.sort();
   const fields:string[]=[];
   for(const key of [...indices,...names]){const encoded=encode(item[key],seen);if(encoded!==undefined)fields.push(JSON.stringify(key)+':'+encoded);}
   value='{'+fields.join(',')+'}';
  }
  seen.delete(item);cache?.set(item,value);return value;
 };
 return {
  beginRead(){cache=new WeakMap();},
  endRead(){cache=undefined;},
  text(value:unknown){return encode(value)??'[undefined]';},
  digest(value:unknown){return hashActorText(encode(value)??'[undefined]');},
 };
}
