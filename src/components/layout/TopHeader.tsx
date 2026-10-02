import { t as localize, useLocale } from '../../i18n/locale';
import { InterfaceSwitcher } from '../ui/InterfaceSwitcher';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { sound } from '../../utils/audio';
import { Volume2, VolumeX, Zap, Plus, X } from 'lucide-react';
import { CLASSES, ASSETS } from '../../data/gameData';
import { RpgIcon } from '../ui/RpgIcon';
import { getEnergyElixirPrice } from '../../utils/dungeonRewards';

interface TopHeaderProps {
  onOpenCharacterSheet: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenCharacterSheet }) => {
  useLocale();
  const { player, combatStats, meditateOrRefillEnergy, premium } = useGame();
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());
  const [showEnergyModal, setShowEnergyModal] = useState(false);

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  if (!player) return null;
  const elixirPrice = getEnergyElixirPrice(premium.active);

  const expPct = Math.min(100, Math.round((player.exp / player.nextExp) * 100));
  const heroImage = (player.classId && CLASSES[player.classId]?.image) || ASSETS.heroHunter;
  const energyPct = Math.min(100, Math.round(((player.energy ?? 100) / (player.maxEnergy ?? 100)) * 100));

  return (
    <>
      <header className="game-header sticky top-0 z-30 px-3 py-3">
        <div className="flex flex-col gap-2 max-w-md mx-auto">
          {/* Main Top Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Avatar & Player Summary */}
            <button
              onClick={onOpenCharacterSheet}
              className="flex items-center gap-2.5 text-left focus:outline-none group active:scale-95 transition-transform"
            >
              <div className="relative">
                <img
                  src={heroImage}
                  alt={player.name}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-600"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-1 -right-1 bg-[#302c24] border border-[#9d8459] text-[#d5ba89] text-[10px] font-mono font-bold px-1 rounded-sm leading-tight">
                  {localize(player.level)}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-100 truncate max-w-[120px]">
                    {premium.active && <span className="text-amber-300" title="Premium">👑 </span>}
                    {player.name}
                  </span>
                  {player.statPoints > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full">
                      +
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-slate-400">{localize(CLASSES[player.classId].name)}{localize(" · Ур. ")}{localize(player.level)}</span>
                {/* EXP Bar */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-[#bca16d] transition-all duration-300"
                      style={{ width: `${expPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#d5ba89]">
                    {localize(expPct)}%
                  </span>
                </div>
              </div>
            </button>

            {/* Quick Energy & Sound & Admin buttons */}
            <div className="flex items-center gap-1.5">
              {/* Energy pill */}
              <button
                onClick={() => setShowEnergyModal(true)}
                className="flex items-center gap-1 min-h-11 px-2 py-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded text-amber-300 active:scale-95 transition-transform"
                title={localize("Энергия для боя и переходов")}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-mono font-bold">
                  {localize(player.energy ?? 100)}/{localize(player.maxEnergy ?? 100)}
                </span>
                <Plus className="w-3 h-3 text-amber-300 bg-amber-600/40 rounded-full" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={handleToggleSound}
                aria-label={localize("Переключить звук")}
                className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-300 hover:bg-white/5 active:scale-95 transition-transform"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-[#d5ba89]" />}
              </button>

            </div>
          </div>

          {/* Currency Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
            {/* Gold */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-amber-500/20 text-amber-300">
              <RpgIcon kind="gold" size={15} className="text-amber-300" />
              <span className="font-bold">{localize(player.gold >= 10000 ? `${(player.gold / 1000).toFixed(1)}k` : player.gold)}</span>
            </div>

            {/* Silver */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-slate-400/20 text-slate-300">
              <RpgIcon kind="silver" size={15} className="text-slate-200" />
              <span className="font-bold">{localize(player.silver ?? 150)}</span>
            </div>

          </div>
        </div>
      <InterfaceSwitcher compact />
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
