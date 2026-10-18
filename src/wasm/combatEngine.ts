import {calculateTypedDamage,type TypedDamageInput} from '../utils/typedDamage';
type Bindings={protocol_version():number;typed_damage_batch(input:Float64Array):Float64Array};
export type CombatLoader=()=>Promise<Bindings>;
export const MAX_COMBAT_BATCH=4096;
const damageTypes=new Set(['true','physical','magic','fire','ice','lightning','poison','dark','holy']);
export function packCombatBatch(hits:readonly TypedDamageInput[]){
 if(hits.length>MAX_COMBAT_BATCH)throw new RangeError('Combat batch exceeds limit');
 const packed=new Float64Array(hits.length*8);
 hits.forEach((hit,i)=>{
  if(!damageTypes.has(hit.damageType))throw new RangeError('Invalid damage type');
  const values=[hit.damageType==='true'?0:hit.damageType==='physical'?1:2,hit.power,hit.multiplier,
   hit.targetDefense,hit.targetMagicDefense,hit.armorPenetration,hit.damageType==='true'?0:hit.targetResistances?.[hit.damageType]??0,hit.extraDamageMultiplier??1];
  if(values.some(value=>!Number.isFinite(value)||Math.abs(value)>1e12))throw new RangeError('Invalid combat input');
  packed.set(values,i*8);
 });
 return packed;
}
export const loadCombatWasm:CombatLoader=async()=>{
 const module=await import('./generated/aethelgard_engine.js');
 await module.default();return module;
};
/** Opt-in pure calculation pilot. Never accepts or writes a player's progress.
 * Disabled by default: small per-turn formulas have no proven gameplay benefit.
 * Initial rendering never waits for WASM; a failed load permanently uses TS. */
export function createCombatCalculator({enabled=false,load=loadCombatWasm,initTimeoutMs=3000}:{enabled?:boolean;load?:CombatLoader;initTimeoutMs?:number}={}){
 let pending:Promise<Bindings|null>|undefined;
 return async(hits:readonly TypedDamageInput[]):Promise<Float64Array>=>{
  if(hits.length>MAX_COMBAT_BATCH)throw new RangeError('Combat batch exceeds limit');
  const inputs=hits.map(hit=>({...hit,targetResistances:{...hit.targetResistances}}));
  const packed=packCombatBatch(inputs);
  const reference=()=>{
   const result=Float64Array.from(inputs,calculateTypedDamage);
   if(result.some(value=>!Number.isSafeInteger(value)||value<1))throw new RangeError('Combat result out of range');
   return result;
  };
  if(!enabled||!hits.length)return reference();
  pending??=new Promise(resolve=>{
   const timer=setTimeout(()=>resolve(null),initTimeoutMs);
   Promise.resolve().then(load).then(module=>resolve(module.protocol_version()===1?module:null),()=>resolve(null)).catch(()=>resolve(null)).finally(()=>clearTimeout(timer));
  });
  const module=await pending;
  if(!module)return reference();
  try{
   const result=module.typed_damage_batch(packed);
   if(result.length!==hits.length||result.some(value=>!Number.isSafeInteger(value)||value<1))throw new Error('Invalid WASM result');
   return result;
  }catch{pending=Promise.resolve(null);return reference();}
 };
}
