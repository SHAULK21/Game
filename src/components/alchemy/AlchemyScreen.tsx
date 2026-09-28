import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ALCHEMY_RECIPES } from '../../data/gameData';
import { FlaskConical, Sparkles, Check, Flame } from 'lucide-react';
import { sound } from '../../utils/audio';

export const AlchemyScreen: React.FC = () => {
  const { player, craftAlchemy } = useGame();
  const [craftingRecipeId, setCraftingRecipeId] = useState<string | null>(null);
  const [craftFeedback, setCraftFeedback] = useState<string | null>(null);

  if (!player) return null;

  const handleCraft = (recipeId: string) => {
    setCraftingRecipeId(recipeId);
    setCraftFeedback(null);

    setTimeout(() => {
      craftAlchemy(recipeId);
      setCraftFeedback('Зелье успешно сварено и добавлено в вашу сумку!');
      setCraftingRecipeId(null);
    }, 600);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#091811] to-[#0a0f1d] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-400/40 text-emerald-400">
              <FlaskConical className="w-6 h-6 animate-pulse" />
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
            <span className="text-[10px] font-mono text-slate-400 block">Зелий сварено:</span>
            <span className="text-xs font-mono text-emerald-300 font-bold">
              {player.statsSummary.potionsCrafted} шт.
            </span>
          </div>
        </div>
      </div>

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
            return (
              <div
                key={rec.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                      {rec.icon}
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
                    disabled={isCrafting}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white active:scale-95 transition-all flex items-center gap-1 shadow-sm shrink-0"
                  >
                    <FlaskConical className={`w-3.5 h-3.5 ${isCrafting ? 'animate-spin' : ''}`} />
                    <span>{isCrafting ? 'Варка...' : 'Сварить'}</span>
                  </button>
                </div>

                {/* Ingredients tag list */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500">Ингредиенты:</span>
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
