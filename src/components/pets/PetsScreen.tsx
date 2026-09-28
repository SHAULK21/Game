import React from 'react';
import { Dog, Sparkles, Check } from 'lucide-react';
import { PETS_LIST } from '../../data/gameData';
import { useGame } from '../../context/GameContext';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/telegram';

export const PetsScreen: React.FC = () => {
  const { player } = useGame();
  if (!player) return null;

  const activeId = player.activePet?.id;

  const selectPet = (petId: string) => {
    const pet = PETS_LIST.find(p => p.id === petId);
    if (!pet || activeId === pet.id) return;
    const raw = localStorage.getItem('aethelgard_save_v1_data');
    if (!raw) return;
    try {
      const save = JSON.parse(raw);
      if (save.player) {
        save.player.activePet = pet;
        localStorage.setItem('aethelgard_save_v1_data', JSON.stringify(save));
        sound.playClick();
        triggerHaptic('success');
        window.location.reload();
      }
    } catch {
      return;
    }
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#071918] to-[#0a0f1d] p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-950/70 border border-teal-500/30 flex items-center justify-center">
            <Dog className="w-7 h-7 text-teal-300" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-teal-400 font-mono">Компаньоны</div>
            <h2 className="font-cinzel text-lg font-bold">Питомцы</h2>
            <p className="text-[10px] text-slate-500">Активный питомец усиливает характеристики героя.</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {PETS_LIST.map(pet => {
          const active = pet.id === activeId;
          return (
            <div key={pet.id} className={\`rounded-xl border p-3 \${active ? 'border-teal-400/60 bg-teal-950/20' : 'border-slate-800 bg-[#0a0f1d]'}\`}>
              <div className="flex items-center gap-3">
                <div className="text-4xl w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">{pet.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-cinzel text-sm font-bold">{pet.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">{pet.rarity}</span>
                  </div>
                  <div className="text-[10px] text-emerald-300 mt-1">{pet.passiveBonus}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{pet.activeSkillName}: {pet.activeSkillDesc}</div>
                </div>
                <button onClick={() => selectPet(pet.id)} className={\`shrink-0 px-2.5 py-2 rounded-lg text-[10px] font-bold \${active ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-200'}\`}>
                  {active ? <><Check className="w-3 h-3 inline mr-1" />Активен</> : 'Выбрать'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 text-[10px] text-slate-500 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-teal-400" />
        Пассивные бонусы активного питомца уже учитываются в боевых характеристиках.
      </div>
    </div>
  );
};
