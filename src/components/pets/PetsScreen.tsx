import React, { useState } from 'react';
import { PETS_LIST } from '../../data/gameData';
import { useGame } from '../../context/GameContext';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, RpgButton, SectionTitle } from '../ui/BestiaryUI';

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
  const { player, setActivePet, craftPet } = useGame();
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!player) return null;

  const activeId = player.activePet?.id;
  const owned = new Set(player.craftedPetIds || ['pet_wolf']);

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#514633] bg-[#111416]">
            <RpgIcon kind="pet" size={27} className="text-teal-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-teal-400">Компаньоны</div>
            <h2 className="font-cinzel text-lg font-bold">Крафт питомцев</h2>
            <p className="text-xs text-slate-500">Редкие питомцы создаются из ресурсов высоких уровней шахты.</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          Горное дело: <span className="font-bold text-amber-300">{player.miningLevel} ур.</span>
        </div>
      </BestiaryPanel>

      {feedback && (
        <div role="status" className="rounded-xl border border-teal-500/25 bg-teal-950/20 p-2.5 text-xs text-teal-100">
          {feedback}
        </div>
      )}

      <div className="space-y-2">
        {PETS_LIST.map(pet => {
          const active = pet.id === activeId;
          const isOwned = owned.has(pet.id);
          const recipe = PET_RECIPES[pet.id];
          const levelReady = !recipe || player.miningLevel >= recipe.miningLevelReq;

          return (
            <BestiaryPanel key={pet.id} className={`p-3 ${active ? 'border-teal-400/60 bg-teal-950/20' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-950"><RpgIcon kind="pet" size={34} className="text-teal-300" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel text-sm font-bold">{pet.name}</span>
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-slate-400">{pet.rarity}</span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-300">{pet.passiveBonus}</div>
                  <div className="mt-1 text-xs text-slate-500">{pet.activeSkillName}: {pet.activeSkillDesc}</div>

                  {!isOwned && recipe && (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <div className={`text-[11px] font-bold ${levelReady ? 'text-amber-300' : 'text-rose-300'}`}>
                        Требуется горное дело {recipe.miningLevelReq} ур.
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recipe.ingredients.map(ingredient => {
                          const have = player.inventory.reduce((sum, item) =>
                            sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0), 0);
                          return (
                            <span key={ingredient.name} className={`rounded border px-1.5 py-1 text-xs ${have >= ingredient.count ? 'border-emerald-500/30 text-emerald-300' : 'border-rose-500/30 text-rose-300'}`}>
                              {ingredient.name} {have}/{ingredient.count}
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
                  <RpgButton
                    variant={active ? 'primary' : 'secondary'}
                    onClick={() => {
                      const ok = setActivePet(pet.id);
                      setFeedback(ok ? `${pet.name} выбран.` : 'Не удалось выбрать питомца.');
                    }}
                    icon={active ? 'character' : undefined}
                    className="w-full"
                  >
                    {active ? 'Активен' : 'Выбрать питомца'}
                  </RpgButton>
                ) : (
                  <RpgButton
                    onClick={() => {
                      const result = craftPet(pet.id);
                      setFeedback(result.message);
                    }}
                    disabled={!levelReady}
                    variant="primary"
                    icon="forge"
                    className="w-full disabled:opacity-35"
                  >
                    Создать питомца
                  </RpgButton>
                )}
              </div>
            </BestiaryPanel>
          );
        })}
      </div>

      <BestiaryPanel className="flex items-center gap-2 p-3 text-xs text-slate-500">
        <RpgIcon kind="skill" size={18} className="text-teal-400" />
        Снежный лютоволк доступен сразу. Остальные питомцы требуют редких руд и материалов из шахты.
      </BestiaryPanel>
    </FolioPage>
  );
};
