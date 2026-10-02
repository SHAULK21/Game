import { t as localize, useLocale } from '../../i18n/locale';
import { craftStageLockReason, regionalSealName } from '../../utils/regionalProgress';
import { smithingProgress } from '../../utils/professions';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  BASIC_CRAFT_RECIPES, CRAFT_RARITY_CHANCES, MINE_CATALYST_BY_ORE,
  MINING_NODES, MONSTERS, RARITY_COLORS, REGIONAL_TROPHIES, REGIONS,
  getEquipmentLevelRange, getRegionMonster
} from '../../data/gameData';
import { ItemArtwork } from '../ui/ItemArtwork';
import { Hammer } from 'lucide-react';
import { ClassGearBonus } from '../ui/ClassGearBonus';
import { CLASS_EQUIPMENT, CLASS_GEAR_IDS } from '../../utils/classEquipment';
import type { CharacterClassId } from '../../types/game';

const trophySources = REGIONS.flatMap(region => region.monsters.flatMap(mobId =>
  getRegionMonster(MONSTERS[mobId],region).drops.filter(d => d.type === 'material').map(drop => ({regionId:region.id,mobId,name:drop.itemName}))));

const ingredientSource = (name: string) => {
  const sealRegion = REGIONS.find(r => [regionalSealName(r.id), regionalSealName(r.id,true)].includes(name));
  if (sealRegion) return `${sealRegion.name}: ${name === regionalSealName(sealRegion.id,true) ? 'босс' : 'элита'}, гарантированно за победу`;
  const source = trophySources.find(entry => entry.name === name);
  if (source) return `${localize(REGIONS.find(region => region.id === source.regionId)?.name)}: ${localize(MONSTERS[source.mobId]?.name)}`;
  const ore = MINING_NODES.find(node => node.oreYield === name);
  if (ore) return `Шахта: ${ore.name} (с ${ore.levelReq} ур.)`;
  const catalystOre = Object.entries(MINE_CATALYST_BY_ORE).find(([, catalyst]) => catalyst === name)?.[0];
  if (catalystOre) return `Шахта: жила ${catalystOre}`;
  const monster = Object.values(MONSTERS).find(mob => mob.drops.some(drop => drop.itemName === name));
  return monster ? `С моба: ${monster.name}` : '';
};

const qualityOdds = () => CRAFT_RARITY_CHANCES
  .map(entry => `${localize(RARITY_COLORS[entry.rarity].label)} ${Math.round(entry.chance * 100)}%`)
  .join(' · ');

export const CraftingScreen: React.FC = () => {
  useLocale();
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
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center gap-2 text-amber-300">
          <Hammer className="w-6 h-6" />
          <h2 className="text-xl font-semibold">{localize("Крафт снаряжения")}</h2>
        </div>
        <p className="mt-2 text-xs text-slate-300">{localize("Рецепты постоянны для всех игроков. Трофеи добываются в соседних по уровню локациях; шахтные материалы могут быть из разных жил.")}</p>
        <p className="mt-2 text-xs text-cyan-200">{localize("Базовый комплект — обычные трофеи и руда, качество не ниже необычного. Победы над элитами и боссами открывают усиленные рецепты, качество не ниже редкого.")}</p>
        <p className="mt-2 text-xs text-emerald-300">{localize("Кузнечное дело: ур. ")}{localize(mastery.level)} · {localize(mastery.xp)}/{localize(mastery.nextXp)}{localize(" XP. Редкое качество: +")}{localize(Math.min(10, (mastery.level - 1) * 0.1).toFixed(1))}{localize(" п.п. Опыт даёт создание снаряжения.")}</p>
        <details className="mt-3 text-xs text-slate-300">
          <summary className="cursor-pointer py-2 text-[#d5ba89]">{localize("Шансы качества и заточки")}</summary>
          <p className="mt-2">{localize("Случайное качество до гарантированного минимума и бонуса мастерства: ")}{qualityOdds()}</p>
          <p className="mt-2">{localize("Уровень снаряжения случаен внутри ступени, все уровни равновероятны. Готовая заточка: +1 — 2%, +2 — 1,5%, +3 — 0,9%, +4 — 0,45%, +5 — 0,15%. Без заточки — 95%.")}</p>
        </details>
      </div>

      <label className="block text-xs text-slate-300">{localize("Локация рецептов")}<select
          value={selectedRegionId}
          onChange={event => { setRegionId(event.target.value); setFeedback(null); }}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100"
        >
          {REGIONS.map(region => <option key={region.id} value={region.id}>{localize(region.name)}{localize(" · с ")}{localize(region.minLevel)}{localize(" ур.")}</option>)}
        </select>
      </label>

      {feedback && <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-200">{localize(feedback)}</div>}
      <label className="block text-xs text-slate-300">{localize("Класс снаряжения")}<select value={selectedClass} onChange={event => setClassFilter(event.target.value as CharacterClassId | 'all')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs">
          <option value="all">{localize("Все классы — любые вещи можно носить по уровню")}</option>
          {CLASS_GEAR_IDS.map(id => <option key={id} value={id}>{localize(CLASS_EQUIPMENT[id].label)}{localize(id === player.classId ? ' · ваш герой' : '')}</option>)}
        </select>
      </label>

      <label className="block text-xs text-slate-300">{localize("Уровень рецептов")}<select value={levelFilter} onChange={event => setLevelFilter(event.target.value as 'available' | 'all')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs">
          <option value="available">{localize("Доступные по уровню · до ")}{localize(player.level)}{localize(" ур.")}</option>
          <option value="all">{localize("Все уровни · включая будущие рецепты")}</option>
        </select>
      </label>
      <p className="text-[11px] text-slate-500">{localize("Найдено рецептов: ")}{localize(recipes.length)}{localize(". Общие расходники и снаряжение без классового бонуса тоже показаны.")}</p>
      {recipes.length === 0 && <div role="status" className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">{localize("В этой локации нет рецептов под выбранный класс и уровень. Выберите другую локацию или измените фильтры.")}</div>}
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
            <div key={recipe.id} className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3">
              <div className="flex items-start gap-2">
                <ItemArtwork item={{name:recipe.result?.name || recipe.name,type:recipe.result?.type || 'material',rarity:recipe.result?.rarity || 'common',icon:recipe.icon}} size={40} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100">{localize(recipe.name)}{localize(recipe.huntStage === 'boss' ? ' · Мастерский' : recipe.huntStage === 'elite' ? ' · Усиленный' : '')}</div>
                  {stageLock && <p className="mt-1 text-[11px] text-amber-300">🔒 {localize(stageLock)}</p>}
                  {recipe.result && <ClassGearBonus item={{ ...recipe.result, level: recipe.result.level || 1 }} characterClass={player.classId} />}
                  <p className="mt-0.5 text-[11px] text-slate-400">{localize(recipe.description)}</p>
                  {recipe.regionId && <p className="mt-1 text-[11px] text-[#d5ba89]">{localize("Персонаж: ")}{localize(recipe.levelReq)}{localize(" ур. · Шахта: ")}{localize(recipe.miningLevelReq)}{localize(" ур.")}</p>}
                  {isEquipment && <p className="mt-1 text-[11px] text-[#d5ba89]">{localize("Уровень вещи: ")}{localize(range.min)}–{localize(range.max)}{localize(" · Возможна заточка +1–+5")}</p>}
                  <details className="mt-2 rounded-lg border border-slate-800 px-2">
                    <summary className="cursor-pointer py-2 text-[11px] text-slate-300">{localize("Что нужно для крафта · ")}{localize(requirements.filter(ingredient => ingredient.have >= ingredient.count).length)}/{localize(requirements.length)}{localize(" материалов готово")}</summary>
                    <div className="flex flex-wrap gap-1.5 pb-2">
                    {requirements.map(ingredient => (
                      <span key={ingredient.name} className={`rounded border px-1.5 py-1 text-[11px] ${ingredient.have >= ingredient.count ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'}`}>
                        {localize(ingredient.name)} {localize(ingredient.have)}/{localize(ingredient.count)}
                        <span className="block text-[11px] text-slate-400">{localize(ingredientSource(ingredient.name))}</span>
                      </span>
                    ))}
                    </div>
                  </details>
                </div>
                <button
                  onClick={() => setFeedback(craftBasicItem(recipe.id).message)}
                  disabled={!canCraft}
                  className="ui-primary shrink-0 rounded-lg px-2.5 py-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35"
                >{localize("Создать")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
