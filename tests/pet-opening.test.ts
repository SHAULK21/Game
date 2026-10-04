import test from 'node:test';
import assert from 'node:assert/strict';
import {petBattleOpening} from '../src/utils/petCombat';
import type {Monster,Pet} from '../src/types/game';

test('new encounters reset old HP; only the wolf opening bite reduces it and explains the actual damage',()=>{
 const source={id:'enemy',hp:0,maxHp:258} as Monster;
 for(const pet of [undefined,{id:'pet_golem'},{id:'pet_dragon'},{id:'pet_voidling'}]){
  const opening=petBattleOpening(source,pet as Pet|undefined);
  assert.equal(opening.enemy.hp,258);assert.equal(opening.openingDamage,0);assert.equal(opening.openingMessage,null);
 }
 const wolf=petBattleOpening(source,{id:'pet_wolf'} as Pet);
 assert.equal(wolf.enemy.hp,178);assert.equal(wolf.enemy.maxHp,258);assert.equal(wolf.openingDamage,80);
 assert.match(wolf.openingMessage!,/−80 HP/);assert.equal(source.hp,0,'catalogue/source monster is not mutated');
 const small=petBattleOpening({...source,maxHp:50},{id:'pet_wolf'} as Pet);
 assert.equal(small.enemy.hp,1);assert.equal(small.openingDamage,49);assert.match(small.openingMessage!,/−49 HP/);
 const tiny=petBattleOpening({...source,maxHp:1},{id:'pet_wolf'} as Pet);
 assert.equal(tiny.openingDamage,0);assert.equal(tiny.openingMessage,null,'do not announce damage that was not dealt');
});
