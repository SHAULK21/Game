import {DURATIONS, GOALS, PREPARATIONS, ROUTES, preview} from '../src/game/expeditions/rules';
import {build} from 'esbuild';
import type {MiningNode} from '../src/types/game';
import {miningCritChance} from '../src/utils/mining';
import {residentNeutralUnitGold} from '../src/utils/localMarket';

// Load the actual client catalogue without asking Node to execute image imports.
const bundle = await build({stdin: {contents: "export {MINING_NODES} from './src/data/gameData';", resolveDir: process.cwd(), loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', loader: {'.jpg': 'empty', '.png': 'empty', '.webp': 'empty'}, logLevel: 'silent'});
const {MINING_NODES}: {MINING_NODES: MiningNode[]} = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

console.log('skill,mining,route,goal,hours,crew,preparation,cost,expectedNeutralGold,netGoldPerHour,manualOreOnlyGoldPerHour');
for (const skill of [1, 5, 10, 20]) for (const mining of [1, 15, 40, 95]) {
  // Sustainable stamina regeneration, no bought refill. Excludes gemstones,
  // secondary materials, pickaxes and luck: a conservative manual reference.
  const manual = Math.max(...MINING_NODES.filter(node => node.levelReq <= mining).map(node => {
    const choices = node.baseYieldMax - node.baseYieldMin, depth = node.levelReq - 1;
    const weights = choices === 1 ? [100] : choices === 2 ? [85 + depth * .05, 15 - depth * .05] : [60 + depth * .12, 28 - depth * .12, ...Array(choices - 2).fill(12 / (choices - 2))];
    const ordinary = weights.reduce((sum, weight, index) => sum + weight / 100 * (node.baseYieldMin + index), 0);
    const crit = miningCritChance(node.levelReq);
    const item = {type: 'ore', sellPrice: Math.max(2, Math.round(10 + node.levelReq * 2)), level: node.levelReq};
    const gold = ordinary * (1 - crit) * residentNeutralUnitGold({...item, rarity: 'common'}) + node.baseYieldMax * crit * residentNeutralUnitGold({...item, rarity: 'rare'});
    return gold * (360 / node.staminaCost);
  }));
  for (const route of ROUTES.filter(r => r.skill <= skill && r.mining <= mining)) for (const goal of GOALS) for (const duration of DURATIONS) for (const crew of skill >= 5 ? ['personal', 'hired'] as const : ['personal'] as const) for (const preparation of Object.keys(PREPARATIONS) as (keyof typeof PREPARATIONS)[]) {
    try {
      const forecast = preview({skill, mining, day: '2026-10-15', route: route.id, goal, duration, crew, preparation});
      console.log([skill, mining, route.id, goal, duration, crew, preparation, forecast.cost, forecast.expectedValue.toFixed(4), ((forecast.expectedValue - forecast.cost) / duration).toFixed(4), manual.toFixed(4)].join(','));
    } catch (error) {if ((error as {code?: string}).code !== 'GOAL_LOCKED') throw error;}
  }
}
