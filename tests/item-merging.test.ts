import test from 'node:test';
import assert from 'node:assert/strict';
import {itemMergeQuote, mergeLevel, mergePlayerItems, mergingMultiplier} from '../src/utils/itemMerging';
import {getEffectiveGearStats} from '../src/utils/classEquipment';
import type {GameItem, PlayerCharacter} from '../src/types/game';

const item = (id: string, extra: Partial<GameItem> = {}): GameItem => ({id, templateId: 'sword', name: 'Меч', type: 'weapon', rarity: 'rare', level: 5, upgradeLevel: 8, stats: {attack: 100, critChance: 4}, sellPrice: 50, disassembleYield: {}, icon: '⚔️', ...extra});
const player = (base: GameItem, donor: GameItem, equipped = false) => ({inventory: equipped ? [donor] : [base, donor], equipped: equipped ? {weapon: {...base, isEquipped: true}} : {}, gold: 123, silver: 456} as PlayerCharacter);

test('merging is independent from rarity and sharpening; equal tiers are guaranteed', () => {
  for (let tier = 0; tier < 10; tier++) {
    const base = item('base', {mergeLevel: tier}), donor = item('donor', {mergeLevel: tier, upgradeLevel: 1});
    assert.equal(itemMergeQuote(base, donor).chance, 1);
    const original = player(base, donor, true), merged = mergePlayerItems(original, 'base', 'donor', 0.999999);
    assert.equal(merged.result.success, true); assert.equal(merged.player.inventory.length, 0);
    assert.equal(merged.player.equipped.weapon!.mergeLevel, tier + 1);
    assert.equal(merged.player.equipped.weapon!.upgradeLevel, 8);
    assert.equal(merged.player.equipped.weapon!.rarity, 'rare'); assert.equal(merged.player.equipped.weapon!.id, 'base');
    assert.equal(merged.player.gold, 123); assert.equal(original.inventory.length, 1);
  }
});
test('weaker donors halve the chance for each tier gap; failure consumes only the donor', () => {
  const base = item('base', {mergeLevel: 2}), donor = item('donor');
  assert.equal(itemMergeQuote(item('x', {mergeLevel: 1}), donor).chance, 0.5);
  assert.equal(itemMergeQuote(base, donor).chance, 0.25);
  assert.equal(itemMergeQuote(item('x', {mergeLevel: 9}), donor).chance, 1 / 512);
  const original = player(base, donor), failed = mergePlayerItems(original, 'base', 'donor', 0.25);
  assert.equal(failed.result.success, false); assert.deepEqual(failed.player.inventory, [base]);
  const replay = mergePlayerItems(failed.player, 'base', 'donor', 0);
  assert.equal(replay.player, failed.player); assert.equal(replay.result.success, false);
});
test('reject mismatched, protected, stacked, equipped donor, missing and self merges without losses', () => {
  const base = item('base');
  const invalid: Partial<GameItem>[] = [{id:'base'}, {rarity:'epic'}, {templateId:'other'}, {name:'Другой меч'}, {level:6}, {type:'armor'}, {targetClass:'mage'}, {weaponClass:'bow'}, {armorClass:'light'}, {isLocked:true}, {boundToClan:'clan'}, {stackCount:2}, {isEquipped:true}, {mergeLevel:1}];
  for (const extra of invalid) {
    const donor = item('donor', extra), original = player(base, donor);
    assert.equal(itemMergeQuote(base, donor).chance, 0, JSON.stringify(extra));
    assert.equal(mergePlayerItems(original, 'base', donor.id, 0).player, original);
  }
  for (const extra of [{isLocked:true}, {boundToClan:'clan'}, {mergeLevel:10}, {type:'material' as const}]) {
    const original = player(item('base', extra), item('donor'));
    assert.equal(mergePlayerItems(original, 'base', 'donor', 0).player, original);
  }
  const original = player(base, item('donor'));
  assert.equal(mergePlayerItems(original, 'foreign', 'donor', 0).player, original);
  assert.equal(mergePlayerItems(original, 'base', 'foreign', 0).player, original);
  assert.equal(mergePlayerItems(original, 'base', 'donor', NaN).player, original);
});
test('fusion multiplies core gear stats with sharpening exactly once and preserves affixes', () => {
  const base = item('base', {mergeLevel: 2, stats:{attack:100, defense:50, magicAttack:200, magicDefense:25, critChance:4}, upgradeLevel: 5});
  assert.deepEqual(getEffectiveGearStats(base), {attack:156, defense:78, magicAttack:312, magicDefense:39, critChance:4});
  assert.equal(getEffectiveGearStats(item('old', {upgradeLevel:0})).attack, 100);
  assert.equal(mergeLevel(item('invalid', {mergeLevel:Infinity})), 0); assert.equal(mergingMultiplier(999), 2);
});
