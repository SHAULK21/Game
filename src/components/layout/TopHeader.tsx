import { t as localize, useLocale } from '../../i18n/locale';
import { InterfaceSwitcher } from '../ui/InterfaceSwitcher';
import React, { useState, useSyncExternalStore } from 'react';
import { useGame } from '../../context/GameContext';
import { sound } from '../../utils/audio';
import { Volume2, VolumeX, Zap, Plus, X } from 'lucide-react';
import { RpgIcon } from '../ui/RpgIcon';
import { getEnergyElixirPrice } from '../../utils/dungeonRewards';

interface TopHeaderProps {
  onOpenCharacterSheet: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenCharacterSheet }) => {
  useLocale();
  const { player, meditateOrRefillEnergy, premium } = useGame();
  const isMuted = useSyncExternalStore(sound.subscribe,()=>sound.getIsMuted(),()=>false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);

  const handleToggleSound = () => {
    sound.toggleMute();
  };

  if (!player) return null;
  const elixirPrice = getEnergyElixirPrice(premium.active);

  const expPct = Math.min(100, Math.round((player.exp / player.nextExp) * 100));
  const heroImage = `/assets/sprites/generated/heroes/${player.classId}.webp`;
  const energyPct = Math.min(100, Math.round(((player.energy ?? 100) / (player.maxEnergy ?? 100)) * 100));

  return (
    <>
      <header className="game-header sticky top-0 z-30 px-3 py-3">
        <div className="modern-header-inner max-w-md mx-auto">
          <div className="modern-brand">AETHELGARD</div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={onOpenCharacterSheet} className="modern-profile flex items-center gap-3 min-w-0 text-left" aria-label={localize("Профиль героя")}>
              <img src={heroImage} alt="" className="modern-avatar" />
              <div className="min-w-0"><strong className="block truncate max-w-[150px]">{premium.active && '♛ '}{player.name}</strong>
                <span className="text-xs text-slate-400">{localize("Ур. ")}{player.level}{player.statPoints > 0 && <b className="ml-2 text-amber-300">+{player.statPoints}</b>}</span>
                <div className="modern-exp" role="progressbar" aria-label={localize("Опыт героя")} aria-valuenow={expPct} aria-valuemin={0} aria-valuemax={100}><span style={{width: `${expPct}%`}} /></div>
              </div>
            </button>
            <button onClick={handleToggleSound} aria-label={localize("Переключить звук")} className="w-11 h-11 flex items-center justify-center rounded-lg text-amber-200">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          </div>
          <div className="modern-resources">
            <div className="modern-resource"><RpgIcon kind="gold" size={23} /><b>{player.gold.toLocaleString()}</b></div>
            <div className="modern-resource"><RpgIcon kind="silver" size={23} /><b>{(player.silver ?? 0).toLocaleString()}</b></div>
            <button onClick={() => setShowEnergyModal(true)} className="modern-resource" aria-label={localize("Энергия для боя и переходов")}><Zap size={21} className="text-amber-400 fill-amber-400" /><b>{player.energy}/{player.maxEnergy}</b><Plus size={13} /></button>
          </div>
          <details className="modern-appearance"><summary>{localize("Стиль интерфейса")}</summary><InterfaceSwitcher compact /></details>
        </div>
      </header>

      {/* Energy Modal */}
      {showEnergyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e1422] border border-amber-500/40 rounded-xl p-5 max-w-sm w-full relative">
            <button
              onClick={() => setShowEnergyModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
              <h3 className="font-cinzel text-lg font-bold text-amber-300">{localize("Энергия странника")}</h3>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">{localize("Энергия расходуется на вступление в бой и переходы. Бой стоит 2 ⚡. Естественное восстановление: +1 ⚡ каждые 120 секунд.")}</p>

            <div className="mb-4 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">{localize("Текущий запас:")}</span>
                <span className="text-amber-300 font-bold">{localize(player.energy ?? 100)} / {localize(player.maxEnergy ?? 100)} ⚡</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                  style={{ width: `${energyPct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  meditateOrRefillEnergy('meditate');
                  setShowEnergyModal(false);
                }}
                className="w-full py-2 px-3 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>🧘</span>
                  <span>{localize("Медитация · бесплатно")}</span>
                </div>
                <span className="text-amber-300 font-mono">{localize("+10 ⚡ · 1 раз / 30 мин")}</span>
              </button>

              <button
                onClick={() => {
                  meditateOrRefillEnergy('silver');
                  setShowEnergyModal(false);
                }}
                disabled={premium.loading || (player.silver ?? 0) < elixirPrice || player.energy >= player.maxEnergy}
                className="w-full py-2 px-3 rounded-lg bg-amber-950/70 hover:bg-amber-900 disabled:opacity-50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>🧪</span>
                  <span>{localize("Купить Эликсир Бодрости")}</span>
                </div>
                <span className="text-slate-200 font-mono">+30 ⚡ ({localize(elixirPrice)} 🥈){localize(premium.active ? ' · −50% Premium' : '')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
