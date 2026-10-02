import { ItemArtwork } from '../../../../components/ui/ItemArtwork';
import { craftStageLockReason, regionalSealName } from '../../../../utils/regionalProgress';
import { smithingProgress } from '../../../../utils/professions';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import {
  BASIC_CRAFT_RECIPES, CRAFT_RARITY_CHANCES, MINE_CATALYST_BY_ORE,
  MINING_NODES, MONSTERS, RARITY_COLORS, REGIONAL_TROPHIES, REGIONS,
  getEquipmentLevelRange, getRegionMonster
} from '../../../../data/gameData';
import { ClassGearBonus } from '../../../../components/ui/ClassGearBonus';
import { CLASS_EQUIPMENT, CLASS_GEAR_IDS } from '../../../../utils/classEquipment';
import type { CharacterClassId } from '../../../../types/game';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, RpgButton } from '../ui/BestiaryUI';

const trophySources = REGIONS.flatMap(region => region.monsters.flatMap(mobId =>
  getRegionMonster(MONSTERS[mobId],region).drops.filter(d => d.type === 'material').map(drop => ({regionId:region.id,mobId,name:drop.itemName}))));

const ingredientSource = (name: string) => {
  const sealRegion = REGIONS.find(r => [regionalSealName(r.id), regionalSealName(r.id,true)].includes(name));
  if (sealRegion) return `${sealRegion.name}: ${name === regionalSealName(sealRegion.id,true) ? 'босс' : 'элита'}, гарантированно за победу`;
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
  const [classFilter, setClassFilter] = useState<CharacterClassId | 'all' | null>(null);

  const [levelFilter, setLevelFilter] = useState<'available' | 'all'>('available');

  if (!player) return null;

  const mastery = smithingProgress(player.smithingXp);
  const selectedClass = classFilter ?? player.classId;
  const selectedRegionId = regionId || player.currentRegionId;
  const recipes = BASIC_CRAFT_RECIPES.filter(recipe => (!recipe.regionId || recipe.regionId === selectedRegionId)
    && (selectedClass === 'all' || !recipe.result?.targetClass || recipe.result.targetClass === selectedClass)
    && (levelFilter === 'all' || (recipe.levelReq || 1) <= player.level));

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center gap-2 text-amber-300">
          <RpgIcon kind="forge" size={24} />
          <h2 className="text-xl font-semibold">Крафт снаряжения</h2>
        </div>
        <p className="mt-2 text-xs text-slate-300">Рецепты постоянны для всех игроков. Трофеи добываются в соседних по уровню локациях; шахтные материалы могут быть из разных жил.</p>
        <p className="mt-2 text-xs text-cyan-200">Базовый комплект — обычные трофеи и руда, качество не ниже необычного. Победы над элитами и боссами открывают усиленные рецепты, качество не ниже редкого.</p>
        <p className="mt-2 text-xs text-emerald-300">Кузнечное дело: ур. {mastery.level} · {mastery.xp}/{mastery.nextXp} XP. Редкое качество: +{Math.min(10, (mastery.level - 1) * 0.1).toFixed(1)} п.п. Опыт даёт создание снаряжения.</p>
        <details className="mt-3 text-xs text-slate-300">
          <summary className="min-h-11 cursor-pointer py-3 text-[#d5ba89]">Шансы качества и заточки</summary>
          <p className="mt-2">Случайное качество до гарантированного минимума и бонуса мастерства: {qualityOdds}</p>
          <p className="mt-2">Уровень снаряжения случаен внутри ступени, все уровни равновероятны. Готовая заточка: +1 — 2%, +2 — 1,5%, +3 — 0,9%, +4 — 0,45%, +5 — 0,15%. Без заточки — 95%.</p>
        </details>
      </BestiaryPanel>

      <label className="block text-xs text-slate-300">
        Локация рецептов
        <select
          value={selectedRegionId}
          onChange={event => { setRegionId(event.target.value); setFeedback(null); }}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100"
        >
          {REGIONS.map(region => <option key={region.id} value={region.id}>{region.name} · с {region.minLevel} ур.</option>)}
        </select>
      </label>

      {feedback && <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-200">{feedback}</div>}
      <label className="block text-xs text-slate-300">Класс снаряжения
        <select value={selectedClass} onChange={event => setClassFilter(event.target.value as CharacterClassId | 'all')} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm">
          <option value="all">Все классы — любые вещи можно носить по уровню</option>
          {CLASS_GEAR_IDS.map(id => <option key={id} value={id}>{CLASS_EQUIPMENT[id].label}{id === player.classId ? ' · ваш герой' : ''}</option>)}
        </select>
      </label>

      <label className="block text-xs text-slate-300">Уровень рецептов
        <select value={levelFilter} onChange={event => setLevelFilter(event.target.value as 'available' | 'all')} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm">
          <option value="available">Доступные по уровню · до {player.level} ур.</option>
          <option value="all">Все уровни · включая будущие рецепты</option>
        </select>
      </label>
      <p className="text-[11px] text-slate-500">Найдено рецептов: {recipes.length}. Общие расходники и снаряжение без классового бонуса тоже показаны.</p>
      {recipes.length === 0 && <div role="status" className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">В этой локации нет рецептов под выбранный класс и уровень. Выберите другую локацию или измените фильтры.</div>}
      <div className="space-y-2">
        {recipes.map(recipe => {
          const isEquipment = recipe.result && ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'].includes(recipe.result.type);
          const range = getEquipmentLevelRange(recipe.result?.level || 1);
          const stageLock = craftStageLockReason(player, recipe, REGIONS);
          const unlocked = !stageLock && player.level >= (recipe.levelReq || 1) && player.miningLevel >= (recipe.miningLevelReq || 1);
          const requirements = recipe.ingredients.map(ingredient => ({
            ...ingredient,
            have: player.inventory.reduce((sum, item) => sum + (item.name === ingredient.name ? (item.stackCount ?? 1) : 0), 0)
          }));
          const canCraft = unlocked && requirements.every(ingredient => ingredient.have >= ingredient.count);

          return (
            <BestiaryPanel key={recipe.id} className="p-3">
              <div className="flex items-start gap-2">
                <ItemArtwork item={{ name: recipe.result?.name || recipe.name, type: recipe.result?.type || "material", rarity: recipe.result?.rarity || "common", icon: recipe.icon }} size={40} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100">{recipe.name}{recipe.huntStage === 'boss' ? ' · Мастерский' : recipe.huntStage === 'elite' ? ' · Усиленный' : ''}</div>
                  {stageLock && <p className="mt-1 text-xs text-amber-300">Закрыто: {stageLock}</p>}
                  {recipe.result && <ClassGearBonus item={{ ...recipe.result, level: recipe.result.level || 1 }} characterClass={player.classId} />}
                  <p className="mt-0.5 text-[11px] text-slate-400">{recipe.description}</p>
                  {recipe.regionId && <p className="mt-1 text-[11px] text-[#d5ba89]">Персонаж: {recipe.levelReq} ур. · Шахта: {recipe.miningLevelReq} ур.</p>}
                  {isEquipment && <p className="mt-1 text-[11px] text-[#d5ba89]">Уровень вещи: {range.min}–{range.max} · Возможна заточка +1–+5</p>}
                  <details className="mt-2 rounded-lg border border-slate-800 px-2">
                    <summary className="min-h-11 cursor-pointer py-3 text-xs text-slate-300">
                      Что нужно для крафта · {requirements.filter(ingredient => ingredient.have >= ingredient.count).length}/{requirements.length} материалов готово
                    </summary>
                    <div className="flex flex-wrap gap-1.5 pb-2">
                    {requirements.map(ingredient => (
                      <span key={ingredient.name} className={`rounded border px-1.5 py-1 text-[11px] ${ingredient.have >= ingredient.count ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'}`}>
                        {ingredient.name} {ingredient.have}/{ingredient.count}
                        <span className="block text-[11px] text-slate-400">{ingredientSource(ingredient.name)}</span>
                      </span>
                    ))}
                    </div>
                  </details>
                </div>
                <RpgButton
                  onClick={() => setFeedback(craftBasicItem(recipe.id).message)}
                  disabled={!canCraft}
                  variant="primary"
                  icon="forge"
                  className="shrink-0 px-2.5 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Создать
                </RpgButton>
              </div>
            </BestiaryPanel>
          );
        })}
      </div>
    </FolioPage>
  );
};
