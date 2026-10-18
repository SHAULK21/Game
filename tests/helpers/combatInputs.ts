import type {TypedDamageInput} from '../../src/utils/typedDamage';
// Fixed xorshift32 fixture seed; the engine consumes no random numbers itself.
export function combatInputs(count:number,seed=0x5ae7){
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const types=['physical','magic','fire','ice','lightning','poison','dark','holy','true'] as const;
 return Array.from({length:count},(_,i):TypedDamageInput=>{
  const damageType=types[i%types.length];
  return {damageType,power:Math.floor(next()*100000)/10,multiplier:next()*5,targetDefense:next()*5000-200,
   targetMagicDefense:next()*5000-200,armorPenetration:next()*1000,targetResistances:{[damageType]:next()*400-200},extraDamageMultiplier:next()*2};
 });
}
