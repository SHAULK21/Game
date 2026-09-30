import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASS_BRANCHES, createTalentTree, migrateTalents, learnTalent, resetTalents, talentCost, spentTalentPoints, branchSpent, talentBonuses, talentLockReason, incomingTalentMultiplier, talentManaCost } from '../src/data/talents';
import { addExperience } from '../src/utils/progression';
import type { CharacterClassId, PlayerCharacter } from '../src/types/game';
const player = (id: CharacterClassId = 'archer', level = 100): PlayerCharacter => ({
  classId: id, level, talents: createTalentTree(id), talentPoints: level, silver: 5000,
  attributes: { strength: 10, agility: 10, intelligence: 10, vitality: 10, spirit: 10, willpower: 10, luck: 10 },
} as PlayerCharacter);

for (const id of Object.keys(CLASS_BRANCHES) as CharacterClassId[]) {
  test(`${id}: complete specialization costs 58, second path requires a choice`, () => {
    let p = player(id);
    assert.equal(new Set(p.talents.map(t => t.id)).size, 34);
    for (const branch of ['damage', 'survival', 'class']) {
      assert.equal(p.talents.filter(t => t.branch === branch).length, 10);
    }
    const attributes = { ...p.attributes };
    for (const branch of ['damage', 'survival']) {
      for (const t of p.talents.filter(t => t.branch === branch)) {
        for (let rank = 0; rank < t.maxRank; rank++) p = learnTalent(p, t.id);
      }
    }
    assert.equal(branchSpent(p.talents, 'damage'), 58);
    assert.ok(branchSpent(p.talents, 'survival') < 58);
    assert.equal(p.talentPoints + p.talents.reduce((n, t) => n + spentTalentPoints(t), 0), 100);
    assert.deepEqual(p.attributes, attributes);
  });
}
test('invalid ID, level gates, branch gates and max rank never spend points', () => {
  let p = player('archer', 1);
  p.talentPoints = 100;
  assert.equal(learnTalent(p, 'missing'), p);
  assert.equal(learnTalent(p, 'archer_damage_3'), p);
  assert.equal(learnTalent({ ...p, level: 100 }, 'archer_damage_10').talentPoints, 100);
  for (let rank = 0; rank < 5; rank++) p = learnTalent(p, 'archer_damage_1');
  assert.equal(learnTalent(p, 'archer_damage_1'), p);
  assert.equal(p.talentPoints, 95);
});
test('special cost must be affordable even when its prerequisites are met', () => {
  const p = player();
  p.talents.filter(t => t.branch === 'damage').slice(0, 4).forEach(t => { t.currentRank = 5; });
  p.talentPoints = 4;
  assert.equal(learnTalent(p, 'archer_damage_5'), p);
  p.talentPoints = 5;
  const learned = learnTalent(p, 'archer_damage_5');
  assert.equal(learned.talentPoints, 0);
  assert.equal(talentBonuses(learned.talents).extraStrike, 35);
});
test('old learned bonuses persist; migration is idempotent; reset refunds every point', () => {
  const p = player();
  p.talents = [{ id: 'arc_t1', name: 'Орлиный взор', description: '', tier: 1, maxRank: 5, currentRank: 3, icon: '', effect: { stat: 'critChance', valuePerRank: 3 } }];
  p.talentPoints = 17;
  const migrated = migrateTalents(p);
  assert.equal(migrated.talentPoints, 17);
  assert.equal(talentBonuses(migrated.talents).accuracy, 15);
  assert.equal(talentBonuses(migrated.talents).critChance, 9);
  assert.deepEqual(migrateTalents(migrated), migrated);
  assert.equal(learnTalent(migrated, 'arc_t1'), migrated);
  const reset = resetTalents(migrated);
  assert.equal(reset.talentPoints, 20);
  assert.equal(reset.silver, 3000);
  assert.equal(reset.talents.length, 34);
  assert.equal(resetTalents(reset), reset);
  assert.equal(resetTalents({ ...migrated, silver: 1999 }).talentPoints, 17);
});
test('all old talents preserve paid ranks, including promised secondary bonuses', () => {
  for (const [id, oldId, stat, value, secondary] of [
    ['paladin', 'p_t1', 'spirit', 5, 'strength'], ['mage', 'm_t2', 'mpRegen', 2, 'maxMp'],
  ] as const) {
    const p = player(id);
    p.talents = [{ id: oldId, name: '', description: '', tier: 1, maxRank: 5, currentRank: 4, icon: '', effect: { stat, valuePerRank: value } }];
    const updated = migrateTalents(p);
    assert.ok(talentBonuses(updated.talents)[secondary] > 0);
    assert.equal(spentTalentPoints(updated.talents.at(-1)!), 4);
  }
});
test('mastery unlocks after 100, has rising exact costs, bounded returns and complete refunds', () => {
  let p = player('archer', 100);
  const id = 'archer_mastery_damagePercent';
  assert.match(talentLockReason(p, p.talents.find(t => t.id === id)!)!, /101/);
  p = { ...p, level: 101, talentPoints: 10000 };
  let paid = 0;
  for (let rank = 0; rank < 150; rank++) {
    const talent = p.talents.find(t => t.id === id)!;
    paid += talentCost(talent);
    p = learnTalent(p, id);
  }
  const talent = p.talents.find(t => t.id === id)!;
  assert.equal(spentTalentPoints(talent), paid);
  assert.ok(talentBonuses(p.talents).damagePercent < 10);
  assert.equal(talentBonuses(p.talents).critChance, undefined);
  assert.equal(talentBonuses(p.talents).vampirism, undefined);
  assert.equal(resetTalents(p).talentPoints, 10000);
});
test('class signatures and defensive tradeoffs change combat behavior', () => {
  const signatureStats = new Set<string>();
  for (const id of Object.keys(CLASS_BRANCHES) as CharacterClassId[]) {
    const talent = createTalentTree(id).find(t => t.id === `${id}_class_10`)!;
    signatureStats.add(talent.effect.stat);
  }
  assert.equal(signatureStats.size, 10);
  assert.ok(Math.abs(incomingTalentMultiplier({ defensiveStance: 20, lowHpReduction: 10 }, 0.3) - 0.72) < 1e-10);
  assert.equal(incomingTalentMultiplier({ offensiveStance: 25 }, 0.8), 1.1);
});
test('levels above 100 still earn mastery currency', () => {
  const p = { ...player('archer', 100), exp: 0, nextExp: 10, statPoints: 0, talentPoints: 0 };
  const advanced = addExperience(p, 10).player;
  assert.equal(advanced.level, 101);
  assert.equal(advanced.talentPoints, 1);
  assert.equal(advanced.statPoints, 5);
});

 test('discounted skill costs are rounded and shared by UI and combat', () => {
   const p = player();
   p.talents.find(t => t.id === 'archer_class_3')!.currentRank = 5;
   assert.equal(talentManaCost(25, p.talents), 23);
   assert.equal(talentManaCost(0, p.talents), 0);
 });
