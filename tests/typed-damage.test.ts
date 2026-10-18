import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTypedDamage} from '../src/utils/typedDamage';
// Golden cases captured from the pre-migration GameContext formula.
test('typed damage keeps physical, elemental, true, rounding and resistance rules',()=>{
 const base={power:100,multiplier:1,targetDefense:75,targetMagicDefense:90,armorPenetration:0};
 const cases=[
  [{...base,damageType:'physical'},50],
  [{...base,damageType:'fire'},50],
  [{...base,damageType:'true',targetResistances:{physical:85}},100],
  [{...base,damageType:'physical',armorPenetration:75},100],
  [{...base,damageType:'fire',targetResistances:{fire:1000}},8],
  [{...base,damageType:'fire',targetResistances:{fire:-1000}},88],
  [{...base,damageType:'true',power:2.5},3],
  [{...base,damageType:'ice',power:0},1],
  [{...base,damageType:'physical',targetDefense:-100},100],
  [{...base,damageType:'dark',extraDamageMultiplier:1.25},63],
 ] as const;
 for(const [input,expected]of cases)assert.equal(calculateTypedDamage(input),expected);
});
