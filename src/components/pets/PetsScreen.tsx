import { t as localize, useLocale } from '../../i18n/locale';
import React, { useState } from 'react';
import { Check, Dog, Hammer, LockKeyhole, Sparkles } from 'lucide-react';
import { PETS_LIST } from '../../data/gameData';
import { useGame } from '../../context/GameContext';

const PET_RECIPES: Record<string, { miningLevelReq: number; ingredients: Array<{ name: string; count: number }> }> = {
  pet_dragon: {
    miningLevelReq: 85,
    ingredients: [
      { name: 'Драконит', count: 12 },
      { name: 'Осколок драконьей чешуи', count: 8 },
      { name: 'Драконья искра', count: 2 }
    ]
  },
  pet_fairy: {
    miningLevelReq: 40,
    ingredients: [
      { name: 'Мифриловая руда', count: 10 },
      { name: 'Арканная пыль', count: 8 },
      { name: 'Магическая эссенция', count: 4 }
    ]
  },
  pet_golem: {
    miningLevelReq: 60,
    ingredients: [
      { name: 'Адамантит', count: 10 },
      { name: 'Руническое ядро', count: 4 },
      { name: 'Осколок титана', count: 8 }
    ]
  },
  pet_voidling: {
    miningLevelReq: 95,
    ingredients: [
      { name: 'Эфириум', count: 10 },
      { name: 'Эфирная пыль', count: 12 },
      { name: 'Звёздное ядро', count: 3 }
    ]
  }
};

export const PetsScreen: React.FC = () => {
  useLocale();
  const { player, setActivePet, craftPet } = useGame();
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!player) return null;

  const activeId = player.activePet?.id;
  const owned = new Set(player.craftedPetIds || ['pet_wolf']);

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-950/70 border border-teal-500/30 flex items-center justify-center">
            <Dog className="w-7 h-7 text-teal-300" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-teal-400 font-mono">{localize("Компаньоны")}</div>
            <h2 className="font-cinzel text-lg font-bold">{localize("Крафт питомцев")}</h2>
            <p className="text-[10px] text-slate-500">{localize("Редкие питомцы создаются из ресурсов высоких уровней шахты.")}</p>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-slate-400">{localize("Горное дело: ")}<span className="font-bold text-amber-300">{localize(player.miningLevel)}{localize(" ур.")}</span>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-teal-500/25 bg-teal-950/20 p-2.5 text-[11px] text-teal-100">
          {localize(feedback)}
        </div>
      )}

      <div className="space-y-2">
        {PETS_LIST.map(pet => {
          const active = pet.id === activeId;
          const isOwned = owned.has(pet.id);
          const recipe = PET_RECIPES[pet.id];
          const levelReady = !recipe || player.miningLevel >= recipe.miningLevelReq;

          return (
            <div key={pet.id} className={`rounded-xl border p-3 ${active ? 'border-teal-400/60 bg-teal-950/20' : 'border-slate-800 bg-[#0a0f1d]'}`}>
              <div className="flex items-start gap-3">
                <div className="text-4xl w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">{localize(pet.icon)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel text-sm font-bold">{localize(pet.name)}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">{localize(pet.rarity)}</span>
                  </div>
                  <div className="text-[10px] text-emerald-300 mt-1">{localize(pet.passiveBonus)}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{localize(pet.activeSkillName)}: {localize(pet.activeSkillDesc)}</div>

                  {!isOwned && recipe && (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <div className={`text-[9px] font-bold ${levelReady ? 'text-amber-300' : 'text-rose-300'}`}>
                        <LockKeyhole className="w-3 h-3 inline mr-1" />{localize("Горное дело ")}{localize(recipe.miningLevelReq)}{localize(" ур.")}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recipe.ingredients.map(ingredient => {
                          const have = player.inventory.reduce((sum, item) =>
                            sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0), 0);
                          return (
                            <span key={ingredient.name} className={`text-[9px] px-1.5 py-0.5 rounded border ${have >= ingredient.count ? 'border-emerald-500/30 text-emerald-300' : 'border-rose-500/30 text-rose-300'}`}>
                              {localize(ingredient.name)} {localize(have)}/{localize(ingredient.count)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                {isOwned ? (
                  <button
                    onClick={async () => {
                      const ok = await setActivePet(pet.id);
                      setFeedback(ok ? `${pet.name} выбран.` : 'Не удалось выбрать питомца.');
                    }}
                    className={`w-full py-2 rounded-lg text-[10px] font-bold ${active ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                  >
                    {active ? <><Check className="w-3 h-3 inline mr-1" />{localize("Активен")}</> : 'Выбрать питомца'}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const result = await craftPet(pet.id);
                      setFeedback(result.message);
                    }}
                    disabled={!levelReady}
                    className="w-full py-2 rounded-lg bg-amber-600 disabled:opacity-35 text-slate-950 text-[10px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Hammer className="w-3.5 h-3.5" />{localize("Создать питомца")}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 text-[10px] text-slate-500 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-teal-400" />{localize("Снежный лютоволк доступен сразу. Остальные питомцы требуют редких руд и материалов из шахты.")}</div>
    </div>
  );
};
