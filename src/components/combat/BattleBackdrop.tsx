import React from 'react';
import plains from '../../assets/battle/plains.webp';
import woods from '../../assets/battle/woods.webp';
import forest from '../../assets/battle/forest.webp';
import crypt from '../../assets/battle/crypt.webp';
import swamp from '../../assets/battle/swamp.webp';
import desert from '../../assets/battle/desert.webp';
import cursed from '../../assets/battle/cursed.webp';
import rift from '../../assets/battle/rift.webp';
import mountain from '../../assets/battle/mountain.webp';
import cave from '../../assets/battle/cave-bat.webp';
import mine from '../../assets/battle/mine.webp';
import spider from '../../assets/battle/spider.webp';
import catacombs from '../../assets/battle/catacombs.webp';
import caveRift from '../../assets/battle/cave-rift.webp';
import caveDragon from '../../assets/battle/cave-dragon.webp';
import arena from '../../assets/battle/arena.webp';

const SCENES = { plains, woods, forest, crypt, swamp, desert, cursed, rift, mountain, cave, mine, spider, arena };
export type BattleScene = keyof typeof SCENES;

const REGION_SCENES: Record<string, BattleScene> = {
  reg_plains: 'plains', reg_whisper_woods: 'woods', reg_forgotten_crypt: 'crypt',
  reg_forest: 'forest', reg_swamp: 'swamp', reg_desert: 'desert',
  reg_cursed: 'cursed', reg_rift: 'rift', reg_dragon: 'mountain'
};
const CAVE_SCENES: Record<string, BattleScene> = {
  cave_bat: 'cave', cave_mine: 'mine', cave_spider: 'spider',
  cave_catacombs: 'crypt', cave_rift: 'rift', cave_dragon: 'cave'
};
const DUNGEON_IMAGES: Record<string, string> = {
  cave_bat: cave, cave_mine: mine, cave_spider: spider,
  cave_catacombs: catacombs, cave_rift: caveRift, cave_dragon: caveDragon
};

export const getBattleScene = (regionId: string | undefined, fallbackRegionId: string, dungeonId?: string): BattleScene =>
  regionId === 'arena' ? 'arena' : (dungeonId && CAVE_SCENES[dungeonId]) || REGION_SCENES[regionId || ''] || REGION_SCENES[fallbackRegionId] || 'plains';

export const getBattleBackground = (scene: BattleScene, dungeonId?: string) =>
  scene === 'arena' ? arena : (dungeonId && DUNGEON_IMAGES[dungeonId]) || SCENES[scene];

export const BattleBackdrop: React.FC<{ scene: BattleScene; dungeonId?: string }> = ({ scene, dungeonId }) =>
  <div aria-hidden="true" className="absolute inset-0 pointer-events-none" data-battle-scene={scene}>
    <img src={getBattleBackground(scene, dungeonId)} alt="" className="h-full w-full object-cover object-center" decoding="async" />
    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/55" />
  </div>;
