import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  BASIC_CRAFT_RECIPES, CRAFT_RARITY_CHANCES, MINE_CATALYST_BY_ORE,
  MINING_NODES, MONSTERS, RARITY_COLORS, REGIONAL_TROPHIES, REGIONS
} from '../../data/gameData';
import { Hammer } from 'lucide-react';

const trophySources = Object.entries(REGIONAL_TROPHIES).flatMap(([regionId, mobs]) =>
  Object.entries(mobs).map(([mobId, drop]) => ({ regionId, mobId, name: drop.name }))
);

const ingredientSource = (name: string) => {
  const source = trophySources.find(entry => entry.name === name);
  if (source) return `${REGIONS.find(region => region.id === source.regionId)?.name}: ${MONSTERS[source.mobId]?.name}`;
  const ore = MINING_NODES.find(node => node.oreYield === name);
  if (ore) return `Шахта: ${ore.name} (с ${ore.levelReq} ур.)`;
  const catalystOre = Object.entries(MINE_CATALYST_BY_ORE).find(([, catalyst]) => catalyst === name)?.[0];
  if (catalystOre) return `Шахта: жила ${catalystOre}`;
  const monster = Object.values(MONSTERS).find(mob => mob.drops.some(drop => drop.itemName === name));
  return monster ? `С моба: ${monster.name}` : '';
};

const qualityOdds = CRAFT_RARITY_CHANCES
  .map(entry => `${RARITY_COLORS[entry.rarity].label} ${Math.round(entry.chance * 100)}%`)
  .join(' · ');

export const CraftingScreen: React.FC = () => {
  const { player, craftBasicItem } = useGame();
  const [regionId, setRegionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!player) return null;

  const selectedRegionId = regionId || player.currentRegionId;
  const recipes = BASIC_CRAFT_RECIPES.filter(recipe => !recipe.regionId || recipe.regionId === selectedRegionId);

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#17100b] to-[#0a0d16] p-4">
        <div className="flex items-center gap-2 text-amber-300">
          <Hammer className="w-6 h-6" />
          <h2 className="font-cinzel text-lg font-bold">Мастерская снаряжения</h2>
        </div>
        <p className="mt-2 text-xs text-slate-300">Рецепты постоянны для всех игроков. Трофеи добываются в соседних по уровню локациях; шахтные материалы могут быть из разных жил.</p>
        <p className="mt-2 text-[10px] text-cyan-300">Качество созданного снаряжения: {qualityOdds}</p>
      </div>

      <label className="block text-xs text-slate-300">
        Локация рецептов
        <select
          value={selectedRegionId}
          onChange={event => { setRegionId(event.target.value); setFeedback(null); }}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100"
        >
          {REGIONS.map(region => <option key={region.id} value={region.id}>{region.name} · с {region.minLevel} ур.</option>)}
        </select>
      </label>

      {feedback && <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-200">{feedback}</div>}

      <div className="space-y-2">
        {recipes.map(recipe => {
          const unlocked = player.level >= (recipe.levelReq || 1) && player.miningLevel >= (recipe.miningLevelReq || 1);
          const requirements = recipe.ingredients.map(ingredient => ({
            ...ingredient,
            have: player.inventory.reduce((sum, item) => sum + (item.name === ingredient.name ? (item.stackCount ?? 1) : 0), 0)
          }));
          const canCraft = unlocked && requirements.every(ingredient => ingredient.have >= ingredient.count);

          return (
            <div key={recipe.id} className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3">
              <div className="flex items-start gap-2">
                <span className="text-2xl shrink-0">{recipe.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100">{recipe.name}</div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{recipe.description}</p>
                  {recipe.regionId && <p className="mt-1 text-[10px] text-cyan-300">Персонаж: {recipe.levelReq} ур. · Шахта: {recipe.miningLevelReq} ур. · Уровень вещи: {recipe.result?.level}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {requirements.map(ingredient => (
                      <span key={ingredient.name} className={`rounded border px-1.5 py-1 text-[9px] ${ingredient.have >= ingredient.count ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'}`}>
                        {ingredient.name} {ingredient.have}/{ingredient.count}
                        <span className="block text-[8px] text-slate-400">{ingredientSource(ingredient.name)}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setFeedback(craftBasicItem(recipe.id).message)}
                  disabled={!canCraft}
                  className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-2 text-[10px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Создать
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
