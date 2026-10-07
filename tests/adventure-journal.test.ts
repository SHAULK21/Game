import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { STORY_CHAPTERS } from '../src/data/storyScenes';
import { migrateAdventureJournal, availableAdventureChapters } from '../src/utils/adventureJournal';
import type { PlayerCharacter, Quest } from '../src/types/game';

async function setup(style = 'modern') {
  const bundle = await build({
    stdin: { contents: `import React,{act}from'react';import{createRoot}from'react-dom/client';import{GameProvider,useGame}from'./src/context/GameContext';import{AdventureStory}from'./src/components/dialogs/AdventureStory';import{MoreMenuScreen}from'${style === 'modern' ? './src/components/more/MoreMenuScreen' : './src/interfaces/fantasy/components/more/MoreMenuScreen'}';import{MONSTERS,REGIONS,getRegionMonster}from'./src/data/gameData';function Content(){window.game=useGame();const g=window.game;return g.player?.adventureJournal?.pending&&(!g.isInCombat||g.isCombatEnded)?<AdventureStory/>:<MoreMenuScreen onOpenAdmin={()=>{}}/>;}window.queen=getRegionMonster(MONSTERS.m_queen_bat,REGIONS[0]);window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Content/></GameProvider>);};`, resolveDir: process.cwd(), loader: 'tsx' },
    plugins: [{ name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }],
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' }
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true; w.Headers = Headers; w.crypto.randomUUID = () => crypto.randomUUID();
  w.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ resetVersion: 0, active: false, items: [], ok: true, isAdmin: false }) });
  w.eval(bundle.outputFiles[0].text);
  const settle = () => w.act(async () => { await new Promise(r => setTimeout(r,20)); });
  const save = () => JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));
  const reload = async (mutate?: (save: any) => void) => {
    const snapshot = save();
    await w.act(async () => w.root.unmount());
    if (mutate) { mutate(snapshot); w.localStorage.setItem('aethelgard_save_v1_data_749219401', JSON.stringify(snapshot)); }
    await w.act(async () => w.mount()); await settle();
  };
  const button = (text: string) => [...w.document.querySelectorAll('button')].find((b:any) => b.textContent.trim() === text) as any;
  await w.act(async () => w.mount());
  await w.act(async () => w.game.createCharacter('Мандрівник', 'warrior'));
  return { dom, w, settle, save, reload, button };
}

test('queen story waits for legal access, survives reload and starts a single fight only after reading or skipping', async () => {
  const { dom, w, reload, button } = await setup();
  try {
    await w.act(async () => assert.equal(w.game.startBattleWithMonster(w.queen), false));
    assert.equal(w.game.player.adventureJournal.pending, undefined, 'locked bosses cannot unlock a scene');
    await reload(s => { s.player.level = 4; s.player.regionProgress.reg_plains = { kills: 6, eliteWins: 2, bossWins: 0 }; });
    const energy = w.game.player.energy;
    await w.act(async () => assert.equal(w.game.startBattleWithMonster(w.queen, { chain: false, energyCost: 3 }), true));
    assert.equal(w.game.isInCombat, false); assert.equal(w.game.player.energy, energy);
    assert.equal(w.game.player.adventureJournal.pending.chapter, 'first-boss');
    assert(w.document.querySelector('[role="dialog"]'));
    await w.act(async () => button('Далее').click());
    assert.equal(w.game.player.adventureJournal.pending.step, 1);
    await reload();
    assert.equal(w.game.player.adventureJournal.pending.step, 1); assert.equal(w.game.isInCombat, false);
    assert(w.document.querySelector('img').src.endsWith('/first-boss.webp'));
    await w.act(async () => { w.game.finishAdventureStory(); w.game.finishAdventureStory(); });
    assert.equal(w.game.player.energy, energy - 3); assert.equal(w.game.isInCombat, true);
    assert.equal(w.game.activeMonster.id, 'm_queen_bat'); assert.equal(w.game.player.adventureJournal.pending, undefined);
    await w.act(async () => w.game.performPlayerAction('flee'));
    await w.act(async () => w.game.exitCombat());
    await w.act(async () => w.game.startBattleWithMonster(w.queen, { chain: false, energyCost: 0 }));
    assert.equal(w.game.isInCombat, true); assert.equal(w.game.player.adventureJournal.pending, undefined, 'second encounters do not repeat the scene');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('dungeon boss scene preserves the room, remaining HP and zero-energy fight across reload', async () => {
  const { dom, w, reload } = await setup();
  try {
    await reload(s => { s.player.level = 4; });
    await w.act(async () => w.game.enterDungeon('cave_bat'));
    assert(w.game.activeDungeonRun);
    await reload(s => {
      s.activeDungeonRun.currentRoomIndex = s.activeDungeonRun.totalRooms - 1;
      s.activeDungeonRun.savedHp = 25; s.activeDungeonRun.savedMp = 10;
    });
    const energy = w.game.player.energy;
    await w.act(async () => assert.equal(w.game.proceedDungeonRoom('fight'), true));
    assert.equal(w.game.player.adventureJournal.pending.chapter, 'first-boss');
    assert.equal(w.game.isInCombat, false); assert.equal(w.game.player.energy, energy);
    await reload();
    assert.equal(w.game.activeDungeonRun.dungeonId, 'cave_bat');
    await w.act(async () => assert.equal(w.game.finishAdventureStory(), true));
    assert.equal(w.game.player.energy, energy); assert.equal(w.game.isInCombat, true);
    assert.equal(w.game.combatPlayerHp, 25); assert.equal(w.game.combatPlayerMp, 10);
    assert.equal(w.game.activeDungeonRun.rooms[w.game.activeDungeonRun.currentRoomIndex].resolved, false);
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

for (const style of ['modern', 'fantasy']) {
  test(`${style}: royal reward opens one saved return scene and journal replay never awards gold, XP or another battle`, async () => {
    const { dom, w, reload, button } = await setup(style);
    try {
      await reload(s => { s.player.firstJourney = 'done'; s.quests.find((q:any) => q.id === 'q_royal_first_journey').completed = true; });
      const gold = w.game.player.gold;
      await w.act(async () => { w.game.claimQuestReward('q_royal_first_journey'); w.game.claimQuestReward('q_royal_first_journey'); });
      assert.equal(w.game.player.gold, gold + 120); assert.equal(w.game.player.adventureJournal.pending.chapter, 'royal-return');
      await w.act(async () => button('Далее').click());
      await reload(); assert.equal(w.game.player.adventureJournal.pending.step, 1);
      await w.act(async () => button('Пропустить').click());
      assert.equal(w.game.player.adventureJournal.pending, undefined);
      await reload();
      assert.equal(w.game.player.adventureJournal.pending, undefined); assert.equal(w.game.player.gold, gold + 120);
      const before = JSON.stringify({ player: w.game.player, quests: w.game.quests });
      await w.act(async () => button('Журнал приключений').click());
      const royal = [...w.document.querySelectorAll('button')].find((b:any) => b.textContent.includes('Возвращение к королю')) as any;
      const locked = [...w.document.querySelectorAll('button')].find((b:any) => b.textContent.includes('Первая встреча с боссом')) as any;
      assert.equal(locked.disabled, true);
      await w.act(async () => royal.click()); assert(w.document.querySelector('[role="dialog"]'));
      await w.act(async () => button('Далее').click());
      await w.act(async () => button('К журналу').click());
      assert.equal(w.document.querySelector('[role="dialog"]'), null);
      assert.equal(JSON.stringify({ player: w.game.player, quests: w.game.quests }), before);
      assert.equal(w.game.isInCombat, false);
      await w.act(async () => w.game.claimQuestReward('q_royal_first_journey'));
      assert.equal(w.game.player.gold, gold + 120); assert.equal(w.game.player.adventureJournal.pending, undefined);
    } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
  });
}

test('old milestones unlock replay without automatic scenes; all story illustrations exist', () => {
  const player = { firstJourney: 'done', regionProgress: { reg_plains: { kills: 6, eliteWins: 2, bossWins: 1 } } } as unknown as PlayerCharacter;
  const quests = [{ id: 'q_royal_first_journey', claimed: true }] as Quest[];
  const migrated = migrateAdventureJournal(player, quests);
  assert.equal(migrated.adventureJournal?.pending, undefined);
  assert.deepEqual(availableAdventureChapters(migrated), ['intro', 'royal-order', 'royal-return', 'first-boss']);
  assert.equal(migrateAdventureJournal(migrated, quests), migrated);
  for (const chapter of STORY_CHAPTERS) for (const scene of chapter.scenes) {
    assert(existsSync(`public/assets/story/${scene.imageId || scene.id}.webp`), scene.id);
    assert(scene.ru.every(Boolean)); assert(scene.uk.every(Boolean));
  }
});
