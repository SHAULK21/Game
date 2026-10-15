import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyOrder, dailyRumour, distribution, DURATIONS, HOUR, legacyPremiumLoot, MATERIALS, outcome, preview, resolveExpedition, ROUTES, skillBonuses, trainingCost, type RulesInput} from '../src/game/expeditions/rules';
import {residentNeutralUnitGold, residentUnitGold} from '../src/utils/localMarket';

const base: RulesInput = {skill: 1, mining: 1, day: '2026-10-15', route: 'old-mine', goal: 'balanced', duration: 1, preparation: 'none', crew: 'personal'};
test('training prices and bonuses use the exact 1..20 progression', () => {
  assert.equal(trainingCost(1), 500); assert.equal(trainingCost(5), 12500); assert.equal(trainingCost(10), 50000); assert.equal(trainingCost(19), 180500); assert.equal(trainingCost(20), null);
  assert.equal(Array.from({length: 19}, (_, i) => trainingCost(i + 1)!).reduce((sum, price) => sum + price, 0), 1235000);
  assert.deepEqual(skillBonuses(20), {quantity: .38, valuableWeight: .19});
  for (const bad of [0, -1, 21, NaN, 1.5]) assert.throws(() => trainingCost(bad));
});
test('catalog, route and goal constraints cannot unlock high-level ore', () => {
  const weighted = distribution(base);
  assert.equal(weighted.reduce((sum, item) => sum + item.probability, 0), 1);
  assert.ok(weighted.every(item => item.material.minLevel === 1));
  assert.throws(() => distribution({...base, route: 'deep-tunnels'}), /Требуются/);
  assert.throws(() => distribution({...base, skill: 5, route: 'deep-tunnels'}), /горное дело/);
  assert.throws(() => distribution({...base, goal: 'valuable'}), /нет доступных/);
  assert.throws(() => distribution({...base, crew: 'hired'}), /Бригада/);
  const selected = distribution({...base, goal: 'ore'});
  const coal = (list: typeof selected) => list.find(item => item.material.id === 'coal')!.probability;
  const herb = (list: typeof selected) => list.find(item => item.material.id === 'herb')!.probability;
  assert.ok(Math.abs(coal(selected) / herb(selected) / (coal(weighted) / herb(weighted)) - 2) < 1e-12);
  for (const day of ['bogus', '2026-02-30', '2026-00-01']) assert.throws(() => dailyRumour(day));
});
test('snapshot and early return preserve exact deterministic results without a minimum rare reward', () => {
  const input = {...base, skill: 20, mining: 100, route: 'abandoned' as const, preparation: 'provisions' as const, duration: 7 as const};
  const snapshot = resolveExpedition(input, 'fixed-private-seed');
  assert.deepEqual(resolveExpedition(input, 'fixed-private-seed'), snapshot);
  assert.equal(snapshot.cost, 56);
  assert.deepEqual(outcome(snapshot, 299999).loot, []);
  const oneRare = {...snapshot, base: [{materialId: 'draconite', quantity: 1}], event: null};
  assert.deepEqual(outcome(oneRare, 300000).loot, []);
  assert.equal(outcome(snapshot, 7 * HOUR).complete, true);
  assert.equal(outcome(snapshot, 7 * HOUR).miningXp, 175);
  assert.equal(outcome({...snapshot, crew: 'hired'}, 7 * HOUR).miningXp, 0);
  const early = outcome(snapshot, 3.5 * HOUR);
  assert.equal(early.miningXp, Math.floor(175 * .5 * .85));
  for (const item of early.loot) assert.equal(item.quantity, Math.floor(snapshot.base.find(row => row.materialId === item.materialId)!.quantity * .425));
});
test('brigade and event fractions use unbiased seeded rounding', () => {
  let zeros = 0, total = 0, eventCount = 0;
  for (let index = 0; index < 3000; index++) {
    const run = resolveExpedition({...base, skill: 10, mining: 40, crew: 'hired', goal: 'valuable'}, 'test-' + index);
    assert.ok(run.base.every(item => Number.isInteger(item.quantity) && item.quantity > 0));
    if (!run.base.length) zeros++;
    total += run.base.reduce((sum, item) => sum + item.quantity, 0);
    if (run.event) eventCount++;
  }
  assert.ok(total > 0); assert.ok(eventCount > 450 && eventCount < 750);
  // A one-unit rare roll is not rounded up unconditionally by the .65 crew factor.
  const snapshot = resolveExpedition({...base, skill: 5, mining: 40, crew: 'hired'}, 'fixed');
  assert.equal(snapshot.cost, 5); assert.ok(zeros > 0, 'fractional rare rolls sometimes produce zero rather than a guaranteed minimum');
});
test('forecast agrees with sampled resolution and the starting brigade covers ordinary wages', () => {
  for (const input of [base, {...base, skill: 5, crew: 'hired' as const}, {...base, skill: 20, mining: 95, route: 'abandoned' as const, duration: 7 as const, crew: 'hired' as const, preparation: 'tool' as const}]) {
    const forecast = preview(input);
    const expected = forecast.items.reduce((sum, item) => sum + item.expected, 0);
    let sample = 0;
    for (let i = 0; i < 4000; i++) sample += resolveExpedition(input, 'forecast-' + i).base.reduce((sum, item) => sum + item.quantity, 0);
    assert.ok(Math.abs(sample / 4000 - expected) / expected < .06, `${sample / 4000} vs ${expected}`);
    if (input.crew === 'hired' && input.skill === 5) assert.ok(forecast.expectedValue > forecast.cost);
  }
});
test('orders use a fixed neutral price and only common or uncommon available materials', () => {
  const order = dailyOrder(5, 15, '2026-10-15');
  assert.deepEqual(dailyOrder(5, 15, '2026-10-15'), order);
  const material = MATERIALS.find(item => item.id === order.materialId)!;
  assert.ok(material.minLevel <= 15 && ['common', 'uncommon'].includes(material.rarity));
  assert.equal(order.rewardGold, Math.floor(order.quantity * order.unitGold * 1.25));
  const item = {type: 'ore', sellPrice: 2, level: 1, rarity: 'common'};
  assert.equal(residentNeutralUnitGold(item), 10);
  assert.notEqual(residentUnitGold(item, '2026-10-15'), residentUnitGold(item, '2026-10-16'));
});
test('Premium retains its independent original pool without skill 5 and repeats deterministically', () => {
  const loot = legacyPremiumLoot(3, 1, 'premium-window');
  assert.deepEqual(legacyPremiumLoot(3, 1, 'premium-window'), loot);
  assert.ok(loot.every(item => MATERIALS.find(m => m.id === item.materialId)!.minLevel === 1));
});
test('economic matrix covers all durations, skill gates, preparations and both crews', () => {
  let samples = 0;
  for (const skill of [1, 5, 10, 20]) for (const mining of [1, 15, 40, 95]) for (const duration of DURATIONS) for (const route of ROUTES.filter(r => r.skill <= skill && r.mining <= mining)) for (const crew of skill >= 5 ? ['personal', 'hired'] as const : ['personal'] as const) for (const preparation of ['none', 'lantern', 'provisions', 'tool'] as const) {
    const forecast = preview({...base, skill, mining, duration, route: route.id, crew, preparation});
    assert.ok(Number.isFinite(forecast.expectedValue) && forecast.expectedValue > 0);
    assert.ok(forecast.cost >= 0 && forecast.eventSuccess <= 1);
    samples++;
  }
  assert.ok(samples > 500);
});
