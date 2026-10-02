import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { ALCHEMY_RECIPES } from '../../data/gameData';
import { FlaskConical, BatteryCharging } from 'lucide-react';
import { ALCHEMY_TOOLS, getAlchemyToolBonus, alchemyProgress, alchemyExperience } from '../../utils/alchemy';
import { RARITY_COLORS } from '../../data/gameData';
import { ItemArtwork } from '../ui/ItemArtwork';

export const AlchemyScreen: React.FC = () => {
  const { player, craftAlchemy, buyAlchemyTool, equipItem, unequipItem } = useGame();
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
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-400/40 text-emerald-400">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">
                Алхимическая Лаборатория
              </h2>
              <div className="text-[11px] font-mono text-slate-400">
                Уровень алхимии: <span className="text-emerald-300 font-bold">{player.alchemyLevel}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">Энергия алхимии</span>
            <span className="text-xs font-mono text-purple-300 font-bold flex items-center justify-end gap-1">
              <BatteryCharging className="w-3.5 h-3.5" />
              {player.alchemyEnergy}/{player.maxAlchemyEnergy}
            </span>
            <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
              +1 каждые 20 сек.
            </span>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400"><span>{progress.maxed ? 'Максимальный уровень алхимии' : `До уровня ${player.alchemyLevel+1}`}</span><span>{progress.maxed ? `${player.alchemyExp} EXP` : `${progress.current} / ${progress.need} EXP`}</span></div>
          <div role="progressbar" aria-label="Опыт алхимии" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-slate-950 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{width:`${progress.percent}%`}} /></div>
          {nextRecipe && <p className="text-[10px] text-slate-500">Следующий рецепт: {nextRecipe.name} · с {nextRecipe.levelReq} ур.</p>}
        </div>
      </div>

      <section className="ui-panel rounded-xl border p-3 space-y-2">
        <h3 className="text-xs font-bold text-emerald-200">Инструмент алхимика</h3>
        {tool ? <div className="flex items-center gap-2"><ItemArtwork item={tool} size={40}/><div className="flex-1 text-xs"><b>{tool.name}</b><p className="text-[10px] text-slate-400">+{bonus?.expBonus || 0}% опыта · {bonus?.extraChance || 0}% шанс +1 зелья</p></div><button disabled={player.inventory.length>=player.maxInventorySlots} onClick={()=>unequipItem('alchemyTool')} className="rounded border border-slate-700 p-2 text-xs disabled:opacity-40">Снять</button></div> : <p className="text-[11px] text-slate-400">Реторта ускоряет прокачку и иногда даёт дополнительное зелье без расхода дополнительных материалов и энергии. Без инструмента варка тоже доступна.</p>}
        {player.inventory.filter(item=>item.type==='alchemyTool').map(item=><div key={item.id} className="flex items-center gap-2 text-xs"><ItemArtwork item={item} size={32}/><span className="flex-1">{item.name}</span><button disabled={!getAlchemyToolBonus(item,player.alchemyLevel)} onClick={()=>equipItem(item)} className="rounded border border-emerald-700 p-2 disabled:opacity-40">Экипировать</button></div>)}
        <details><summary className="cursor-pointer py-2 text-xs text-emerald-300">Купить реторту · за золото</summary><div className="space-y-2">{ALCHEMY_TOOLS.map(offer=><div key={offer.id} className="rounded border border-slate-800 p-2 text-xs space-y-1"><b className={RARITY_COLORS[offer.rarity].text}>{offer.name} · {RARITY_COLORS[offer.rarity].label}</b><p className="text-[10px] text-slate-400">С {offer.alchemyLevel} ур. алхимии · +{offer.expBonus}% опыта · {offer.extraChance}% шанс +1 зелья</p><button disabled={craftingRecipeId!==null || player.alchemyLevel<offer.alchemyLevel || player.gold<offer.price} onClick={()=>setCraftFeedback(buyAlchemyTool(offer.id).message)} className="w-full rounded border border-slate-700 py-2 disabled:opacity-40">Купить · {offer.price.toLocaleString()} золота</button></div>)}</div></details>
      </section>

      {craftFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs text-center font-medium">
          {craftFeedback}
        </div>
      )}

      {/* Recipes List */}
      <div className="space-y-2.5">
        <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider px-1">
          Изученные рецепты:
        </div>

        <div className="space-y-2">
          {ALCHEMY_RECIPES.map(rec => {
            const isCrafting = craftingRecipeId === rec.id;
            const energyCost = Math.max(4, Math.min(20, 4 + Math.floor(rec.levelReq / 5)));
            const hasEnergy = player.alchemyEnergy >= energyCost;
            return (
              <div
                key={rec.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <ItemArtwork item={{name:rec.resultItem,type:'potion',rarity:'common',icon:rec.icon}} size={32} />
                    </span>
                    <div>
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {rec.name}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {rec.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCraft(rec.id)}
                    disabled={craftingRecipeId !== null || player.alchemyLevel < rec.levelReq || player.level < (rec.heroLevelReq || 1) || !hasEnergy}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed font-bold text-xs text-white active:scale-95 transition-all flex items-center gap-1 shadow-sm shrink-0"
                  >
                    <FlaskConical className={`w-3.5 h-3.5 ${isCrafting ? 'animate-spin' : ''}`} />
                    <span>{isCrafting ? 'Варка...' : player.level < (rec.heroLevelReq || 1) ? `Герой ${rec.heroLevelReq} ур.` : player.alchemyLevel<rec.levelReq ? `С ${rec.levelReq} ур.` : `Сварить · ${energyCost} ⚗`}</span>
                  </button>
                </div>

                {/* Ingredients tag list */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500">Ингредиенты:</span>
                  <span className="text-purple-300">Алхимия: ур. {rec.levelReq}</span>
                  {rec.heroLevelReq && <span className="text-cyan-300">Герой: ур. {rec.heroLevelReq}</span>}
                  <span className="text-emerald-300">+{alchemyExperience(Math.max(6,6+Math.floor(rec.levelReq*.8)),tool,player.alchemyLevel)} EXP</span>
                  <span className={hasEnergy ? 'text-emerald-300' : 'text-rose-300'}>⚗ {energyCost} энергии</span>
                  {rec.ingredients.map((ing, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {ing.name} x{ing.count}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
