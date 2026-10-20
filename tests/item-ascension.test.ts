import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameItem, PlayerCharacter} from '../src/types/game';
import {mergeEquipment, ascensionMaterials, itemAscensionLevel, itemAscensionMultiplier, MAX_ITEM_ASCENSION} from '../src/utils/itemAscension';
import {getEffectiveGearStats} from '../src/utils/classEquipment';
import {selectBulkItems} from '../src/utils/bulkInventory';

const item = (id: string, extra: Partial<GameItem> = {}): GameItem => ({id, templateId:'test_helm', name:'Шолом', type:'helmet', rarity:'rare',
  level:10, upgradeLevel:0, icon:'', stats:{defense:100, magicDefense:50, maxHp:200, critChance:5}, sellPrice:100, disassembleYield:{silver:20}, ...extra});
const player = (inventory: GameItem[], equipped: PlayerCharacter['equipped'] = {}): PlayerCharacter => ({inventory, equipped, maxInventorySlots:10, gold:150, silver:30} as PlayerCharacter);

test('two equipment copies give an independent rank, best sharpening and base rolls without changing rarity or wallets', () => {
  const base = item('base', {upgradeLevel:3, stats:{defense:100, maxHp:200}}), donor = item('donor', {upgradeLevel:8, stats:{defense:900}});
  const original = player([base, donor]), before = structuredClone(original);
  const result = mergeEquipment(original, base.id, donor.id, 'split');
  assert.equal(result.success, true);
  assert.equal(result.item!.id, base.id); assert.equal(result.item!.ascensionLevel,1);
  assert.equal(result.item!.upgradeLevel,8); assert.equal(result.item!.rarity,base.rarity);
  assert.deepEqual(result.item!.stats,base.stats); assert.equal(result.player!.inventory.length,1);
  assert.equal(result.player!.gold,150); assert.equal(result.player!.silver,30);
  assert.deepEqual(original,before);
  const stats=getEffectiveGearStats(result.item!);
  assert.equal(stats.defense,Math.round(100*1.48*1.1)); assert.equal(stats.maxHp,220);
});

test('legacy items stay at rank zero; ascension never boosts critical chance or compounds saved rolls', () => {
  const base=item('base'); assert.equal(itemAscensionLevel(base),0); assert.equal(itemAscensionMultiplier(),1);
  assert.deepEqual(getEffectiveGearStats(base),base.stats);
  for(let rank=0;rank<=MAX_ITEM_ASCENSION;rank++){
    const stats=getEffectiveGearStats({...base,upgradeLevel:25,ascensionLevel:rank});
    assert.equal(stats.defense,Math.round(100*2.5*(1+rank*.1))); assert.equal(stats.maxHp,Math.round(200*(1+rank*.1)));
    assert.equal(stats.critChance,5);assert.deepEqual(base.stats,{defense:100,magicDefense:50,maxHp:200,critChance:5});
  }
});

test('matching checks template, level, rarity, class and rank; protected or foreign progression cannot be consumed', () => {
  const base=item('base');
  for(const extra of [{templateId:'other'},{level:11},{rarity:'epic'},{name:'Інший шолом'},{type:'armor'},{targetClass:'mage'},
    {ascensionLevel:1},{ascensionLevel:-1},{ascensionLevel:1.5},{isLocked:true},{boundToClan:'clan'},{isEquipped:true},
    {upgradeLevel:26},{serverOwned:true},{marketTradable:false}]){
    const p=player([base,item('donor',extra as Partial<GameItem>)]);
    assert.equal(mergeEquipment(p,'base','donor','split').success,false,JSON.stringify(extra));
    assert.equal(p.inventory.length,2);
  }
  assert.equal(mergeEquipment(player([base]),'base','missing','split').success,false);
  assert.equal(mergeEquipment(player([base]),'base','base','split').success,false);
  assert.equal(mergeEquipment(player([item('base',{isLocked:true}),item('donor')]),'base','donor','split').success,false);
  assert.equal(mergeEquipment(player([item('base',{ascensionLevel:5}),item('donor',{ascensionLevel:5})]),'base','donor','split').success,false);
});

test('equipped base keeps its slot; only a bag copy can be consumed', () => {
  const base=item('base',{upgradeLevel:7,isEquipped:true}), donor=item('donor');
  const p=player([donor],{helmet:base}), result=mergeEquipment(p,'base','donor','split');
  assert.equal(result.success,true); assert.equal(result.player!.equipped.helmet!.id,'base');
  assert.equal(result.player!.equipped.helmet!.ascensionLevel,1); assert.equal(result.player!.inventory.length,0);
  assert.deepEqual(ascensionMaterials(p,base).map(item=>item.id),['donor']);
  assert.equal(mergeEquipment(player([donor],{helmet:base}),'donor','base','split').success,false);
});

test('stacked equipment consumes exactly two units, splits the result and refuses a full bag atomically', () => {
  const total=(p:PlayerCharacter)=>p.inventory.reduce((n,item)=>n+(item.stackCount??1),0);
  const p=player([item('stack',{stackCount:5})]);
  const first=mergeEquipment(p,'stack','stack','split');
  assert.equal(first.success,true);assert.equal(total(first.player!),4);
  assert.equal(first.player!.inventory.find(item=>item.id==='stack')!.ascensionLevel,1);
  assert.equal(first.player!.inventory.find(item=>item.id==='split')!.stackCount,3);
  assert.equal(first.player!.inventory.find(item=>item.id==='split')!.ascensionLevel,undefined);
  const p2=player([item('base',{stackCount:2}),item('donor',{stackCount:3})]);p2.maxInventorySlots=2;
  const snapshot=structuredClone(p2);assert.equal(mergeEquipment(p2,'base','donor','split').success,false);assert.deepEqual(p2,snapshot);
  p2.maxInventorySlots=3;const next=mergeEquipment(p2,'base','donor','split');assert.equal(next.success,true);assert.equal(total(next.player!),4);
  assert.equal(mergeEquipment(p,'stack','stack','stack').success,false);
});

test('the keep upgraded bulk filter protects ascended equipment even at sharpening zero', () => {
  const p=player([item('plain'),item('ascended',{ascensionLevel:1})]);
  const filters={rarities:['rare' as const],type:'all' as const,keepUpgraded:true};
  assert.deepEqual(selectBulkItems(p,filters).map(item=>item.id),['plain']);
  assert.equal(selectBulkItems(p,{...filters,keepUpgraded:false}).length,2);
});
