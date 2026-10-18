import type {DamageType,ResistanceMap} from '../types/game';
export interface TypedDamageInput {
 power:number;multiplier:number;damageType:DamageType;targetDefense:number;targetMagicDefense:number;
 armorPenetration:number;targetResistances?:Partial<ResistanceMap>;extraDamageMultiplier?:number;
}
/** Existing server formula. Keep arithmetic order: rounding is part of the balance. */
export function calculateTypedDamage({power,multiplier,damageType,targetDefense,targetMagicDefense,armorPenetration,targetResistances,extraDamageMultiplier=1}:TypedDamageInput){
 if(damageType==='true')return Math.max(1,Math.round(power*multiplier*extraDamageMultiplier));
 const raw=Math.max(1,power*multiplier);
 const defense=damageType==='physical'?Math.max(0,targetDefense-armorPenetration):Math.max(0,targetMagicDefense);
 const mitigation=defense/(defense+(damageType==='physical'?75:90));
 const resistance=Math.max(-75,Math.min(85,targetResistances?.[damageType]??0));
 return Math.max(1,Math.round(raw*(1-mitigation)*(1-resistance/100)*extraDamageMultiplier));
}
