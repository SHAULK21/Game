import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../../../context/GameContext';
import { ALCHEMY_RECIPES } from '../../data/gameData';
import { ALCHEMY_TOOLS, getAlchemyToolBonus, alchemyProgress, alchemyExperience } from '../../../../utils/alchemy';
import { RARITY_COLORS } from '../../data/gameData';
import { ItemArtwork } from '../ui/ItemArtwork';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ProgressBar, RpgButton, SectionTitle } from '../ui/BestiaryUI';

export const AlchemyScreen: React.FC = () => {
  useLocale();
  const { player, craftAlchemy, buyAlchemyTool, equipItem, unequipItem } = useGame();
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'fish'>('all');
  const [craftingRecipeId, setCraftingRecipeId] = useState<string | null>(null);
  const [craftFeedback, setCraftFeedback] = useState<string | null>(null);

  const craftingLock = useRef(false);
  const craftTimer = useRef<number | null>(null);
  useEffect(() => () => { if (craftTimer.current !== null) window.clearTimeout(craftTimer.current); }, []);

  if (!player) return null;
  const progress = alchemyProgress(player.alchemyLevel, player.alchemyExp);
  const tool = player.equipped.alchemyTool;
  const bonus = getAlchemyToolBonus(tool, player.alchemyLevel);
  const nextRecipe = ALCHEMY_RECIPES.filter(recipe=>recipe.levelReq>player.alchemyLevel).sort((a,b)=>a.levelReq-b.levelReq)[0];

  const handleCraft = (recipeId: string) => {
    if (craftingLock.current) return;
    craftingLock.current = true;
    setCraftingRecipeId(recipeId);
    try {
      const success = craftAlchemy(recipeId);
      setCraftFeedback(success
        ? 'Зелье успешно сварено и добавлено в вашу сумку! Опыт алхимии начислен.'
        : 'Не удалось сварить: проверьте энергию алхимии, уровень, ингредиенты и место в сумке.');
    } catch (error) {
      setCraftFeedback(error instanceof Error ? error.message : 'Не удалось сварить зелье.');
    } finally {
      craftTimer.current = window.setTimeout(() => {
        craftingLock.current = false;
        setCraftingRecipeId(null);
        craftTimer.current = null;
      }, 600);
    }
  };

  return (
    <FolioPage className="space-y-3 pt-3">
      {/* Header */}
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#514633] bg-[#111416] text-[#b99558]">
              <RpgIcon kind="alchemy" size={24} />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">{localize("Алхимический фолиант")}</h2>
              <div className="text-xs text-slate-400">{localize("Уровень алхимии: ")}<span className="font-bold text-[#a7bc8e]">{localize(player.alchemyLevel)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-[11px] text-slate-400">{localize("Энергия алхимии")}</span>
            <span className="flex items-center justify-end gap-1 text-xs font-bold text-[#ae9ac4]">
              <RpgIcon kind="energy" size={15} /> {localize(player.alchemyEnergy)}/{localize(player.maxAlchemyEnergy)}
            </span>
            <span className="text-[11px] font-mono text-slate-500 block mt-0.5">{localize("+1 каждые 20 сек.")}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <ProgressBar value={progress.maxed ? progress.need : progress.current} max={progress.need} tone="energy" label={progress.maxed ? 'Максимальный уровень алхимии' : `До уровня ${player.alchemyLevel+1}`} />
          {nextRecipe && <p className="text-[11px] text-slate-500">{localize("Следующий рецепт: ")}{localize(nextRecipe.name)}{localize(" · с ")}{localize(nextRecipe.levelReq)}{localize(" ур.")}</p>}
        </div>
      </BestiaryPanel>

      <BestiaryPanel className="space-y-2 p-3">
        <SectionTitle eyebrow="Орудия и мастерство">{localize("Инструмент алхимика")}</SectionTitle>
        {tool ? <div className="flex items-center gap-2"><ItemArtwork item={tool} size={40}/><div className="flex-1 text-xs"><b>{localize(tool.name)}</b><p className="text-[11px] text-slate-400">+{localize(bonus?.expBonus || 0)}{localize("% опыта · ")}{localize(bonus?.extraChance || 0)}{localize("% шанс +1 зелья")}</p></div><button disabled={player.inventory.length>=player.maxInventorySlots} onClick={()=>unequipItem('alchemyTool')} className="rounded border border-slate-700 p-2 text-xs disabled:opacity-40">{localize("Снять")}</button></div> : <p className="text-[11px] text-slate-400">{localize("Реторта ускоряет прокачку и иногда даёт дополнительное зелье без расхода дополнительных материалов и энергии. Без инструмента варка тоже доступна.")}</p>}
        {player.inventory.filter(item=>item.type==='alchemyTool').map(item=><div key={item.id} className="flex items-center gap-2 text-xs"><ItemArtwork item={item} size={32}/><span className="flex-1">{localize(item.name)}</span><button disabled={!getAlchemyToolBonus(item,player.alchemyLevel)} onClick={()=>equipItem(item)} className="rounded border border-emerald-700 p-2 disabled:opacity-40">{localize("Экипировать")}</button></div>)}
        <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-[#c5b393]">{localize("Купить реторту · за золото")}</summary><div className="space-y-2">{ALCHEMY_TOOLS.map(offer=><div key={offer.id} className="bestiary-panel space-y-2 p-2 text-xs"><b className={RARITY_COLORS[offer.rarity].text}>{localize(offer.name)} · {localize(RARITY_COLORS[offer.rarity].label)}</b><p className="text-xs text-slate-400">{localize("С ")}{localize(offer.alchemyLevel)}{localize(" ур. алхимии · +")}{localize(offer.expBonus)}{localize("% опыта · ")}{localize(offer.extraChance)}{localize("% шанс +1 зелья")}</p><RpgButton variant="secondary" disabled={craftingRecipeId!==null || player.alchemyLevel<offer.alchemyLevel || player.gold<offer.price} onClick={()=>setCraftFeedback(buyAlchemyTool(offer.id).message)} className="w-full">{localize("Купить · ")}{localize(offer.price.toLocaleString(intlLocale()))}{localize(" золота")}</RpgButton></div>)}</div></details>
      </BestiaryPanel>

      {craftFeedback && (
        <div role="status" className="bestiary-panel p-2.5 text-center text-xs font-medium text-[#c5d8b6]">
          {localize(craftFeedback)}
        </div>
      )}

      {/* Recipes List */}
      <div className="space-y-2.5">
        <SectionTitle eyebrow="Рецептурник">{localize("Изученные рецепты")}</SectionTitle>

        <div className="flex gap-2" role="group" aria-label={localize("Фильтр рецептов")}><button aria-pressed={recipeFilter==='all'} onClick={()=>setRecipeFilter('all')} className="rpg-button rpg-button-secondary min-h-11 flex-1 text-xs">{localize("Все рецепты")}</button><button aria-pressed={recipeFilter==='fish'} onClick={()=>setRecipeFilter('fish')} className="rpg-button rpg-button-secondary min-h-11 flex-1 text-xs">{localize("Из улова")}</button></div>

        <div className="space-y-2">
          {ALCHEMY_RECIPES.filter(rec=>recipeFilter==='all'||rec.id.startsWith('alc_fish_')).map(rec => {
            const isCrafting = craftingRecipeId === rec.id;
            const energyCost = Math.max(4, Math.min(20, 4 + Math.floor(rec.levelReq / 5)));
            const hasEnergy = player.alchemyEnergy >= energyCost;
            return (
              <BestiaryPanel
                key={rec.id}
                className="space-y-2 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ItemArtwork item={{ name: rec.resultItem, type: "potion", rarity: "common", icon: rec.icon }} size={40} className="shrink-0" />
                    <div>
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {localize(rec.name)}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {localize(rec.description)}
                      </p>
                    </div>
                  </div>

                  <RpgButton
                    onClick={() => handleCraft(rec.id)}
                    disabled={craftingRecipeId !== null || player.alchemyLevel < rec.levelReq || player.level < (rec.heroLevelReq || 1) || !hasEnergy}
                    variant="primary"
                    icon="alchemy"
                    className="shrink-0 px-3 disabled:opacity-40"
                  >
                    {localize(isCrafting ? 'Варка...' : player.level < (rec.heroLevelReq || 1) ? `Герой ${rec.heroLevelReq} ур.` : player.alchemyLevel<rec.levelReq ? `С ${rec.levelReq} ур.` : `Сварить · ${energyCost} энергии`)}
                  </RpgButton>
                </div>

                {/* Ingredients tag list */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">{localize("Ингредиенты:")}</span>
                  <span className="text-purple-300">{localize("Алхимия: ур. ")}{localize(rec.levelReq)}</span>
                  {rec.heroLevelReq && <span className="text-cyan-300">{localize("Герой: ур. ")}{localize(rec.heroLevelReq)}</span>}
                  <span className="text-emerald-300">+{localize(alchemyExperience(Math.max(6,6+Math.floor(rec.levelReq*.8)),tool,player.alchemyLevel))} EXP</span>
                  <span className={hasEnergy ? 'text-emerald-300' : 'text-rose-300'}>{localize(energyCost)}{localize(" энергии")}</span>
                  {rec.ingredients.map((ing, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {localize(ing.name)} x{localize(ing.count)}
                    </span>
                  ))}
                </div>
              </BestiaryPanel>
            );
          })}
        </div>
      </div>
    </FolioPage>
  );
};
