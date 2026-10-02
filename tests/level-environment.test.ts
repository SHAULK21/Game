import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { groupRegionsByLevel, levelEnvironment } from '../src/utils/levelEnvironment';

test('level presentation covers boundaries and keeps every region without mutating data', () => {
  const regions = [
    { id: 'low', minLevel: 1, levelRange: 'Ур. 1 - 25' },
    { id: 'mid', minLevel: 25, levelRange: 'Ур. 25 - 55' },
    { id: 'high', minLevel: 55, levelRange: 'Ур. 55 - 120' },
  ];
  const snapshot = structuredClone(regions);
  for (const level of [1, 24, 25, 54, 55, 120, 150]) {
    const groups = groupRegionsByLevel(regions, level);
    assert.equal(groups.recommended.length > 0, true);
    assert.deepEqual(Object.values(groups).flat().map(region => region.id).sort(), ['high', 'low', 'mid']);
    assert.ok(groups.future.every(region => region.minLevel > level));
  }
  assert.deepEqual(regions, snapshot);
  assert.equal(levelEnvironment(24).range, '1–24');
  assert.equal(levelEnvironment(25).range, '25–54');
  assert.equal(levelEnvironment(55).range, '55+');
  assert.deepEqual(groupRegionsByLevel(regions, 150).recommended.map(region => region.id), ['high']);
});

test('map highlights suitable regions; spoilers keep earlier and future travel options intact', async () => {
  const bundle = await build({
    stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {WorldScreen} from './src/components/world/WorldScreen';import {REGIONS} from './src/data/gameData';window.regions=REGIONS;window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<WorldScreen/>);};`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'test-context', setup(b) {
      b.onLoad({ filter: /context[\\/]GameContext\.tsx$/ }, () => ({ contents: 'export const useGame=()=>window.game;', loader: 'js' }));
      b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' }));
    } }],
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  const trips: unknown[] = [];
  w.game = { player: { level: 35, currentRegionId: 'reg_plains', activeRegionModId: 'mod_standard', energy: 100 }, travelState: { isTraveling: false }, premium: { active: false }, startTravel: (...args: unknown[]) => { trips.push(args); return { success: true }; } };
  w.eval(bundle.outputFiles[0].text);
  try {
    await w.act(async () => w.mount());
    assert.match(w.document.body.textContent, /Земли опытных героев/);
    const preview = w.document.querySelector('h3');
    assert.equal(preview.textContent, w.regions.find((region: any) => region.id === 'reg_swamp').name);
    const summaries = [...w.document.querySelectorAll('summary')] as any[];
    assert.equal(summaries.length, 2);
    for (const summary of summaries) {
      assert.equal(summary.parentElement.open, false);
      await w.act(async () => summary.click());
      assert.equal(summary.parentElement.open, true);
    }
    // A future region remains inspectable, while its original level gate stays enforced.
    const dragon = [...w.document.querySelectorAll('span')].find((node: any) => node.textContent === w.regions.at(-1).name) as any;
    await w.act(async () => dragon.closest('div.cursor-pointer').click());
    let travel = [...w.document.querySelectorAll('button')].find((button: any) => button.textContent.includes('Отправиться в путь')) as any;
    assert.equal(travel.disabled, true);
    assert.equal(trips.length, 0);
    // Use the suitable region explicitly after inspecting the locked one.
    const suitable = [...w.document.querySelectorAll('span')].find((node: any) => node.textContent === w.regions.find((region: any) => region.id === 'reg_swamp').name) as any;
    await w.act(async () => suitable.closest('div.cursor-pointer').click());
    travel = [...w.document.querySelectorAll('button')].find((button: any) => button.textContent.includes('Отправиться в путь')) as any;
    await w.act(async () => travel.click());
    assert.deepEqual(trips, [['reg_swamp', 'mod_standard']]);
    assert.equal(w.game.player.currentRegionId, 'reg_plains', 'visual selection never relocates the player');
  } finally {
    await w.act(async () => w.root.unmount());
    dom.window.close();
  }
});
