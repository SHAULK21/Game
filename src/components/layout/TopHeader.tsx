import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { sound } from '../../utils/audio';
import { Volume2, VolumeX, ShieldAlert, Zap, Plus, Sparkles, X } from 'lucide-react';
import { CLASSES, ASSETS } from '../../data/gameData';

interface TopHeaderProps {
  onOpenAdmin: () => void;
  onOpenCharacterSheet: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenAdmin, onOpenCharacterSheet }) => {
  const { player, combatStats, meditateOrRefillEnergy } = useGame();
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());
  const [showEnergyModal, setShowEnergyModal] = useState(false);

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  if (!player) return null;

  const expPct = Math.min(100, Math.round((player.exp / player.nextExp) * 100));
  const heroImage = (player.classId && CLASSES[player.classId]?.image) || ASSETS.heroHunter;
  const energyPct = Math.min(100, Math.round(((player.energy ?? 100) / (player.maxEnergy ?? 100)) * 100));

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-b border-cyan-500/20 px-3 py-2 shadow-lg shadow-black/40">
        <div className="flex flex-col gap-1.5 max-w-lg mx-auto">
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
                  className="w-10 h-10 rounded-lg object-cover border border-cyan-400/50 shadow-md shadow-cyan-500/20"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-1 -right-1 bg-cyan-950 border border-cyan-400 text-cyan-200 text-[10px] font-mono font-bold px-1 rounded-sm leading-tight">
                  {player.level}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-cinzel text-xs font-bold text-slate-100 truncate max-w-[100px]">
                    {player.name}
                  </span>
                  {player.statPoints > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full animate-bounce">
                      +
                    </span>
                  )}
                </div>

                {/* EXP Bar */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${expPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-cyan-300">
                    {expPct}%
                  </span>
                </div>
              </div>
            </button>

            {/* Quick Energy & Sound & Admin buttons */}
            <div className="flex items-center gap-1.5">
              {/* Energy pill */}
              <button
                onClick={() => setShowEnergyModal(true)}
                className="flex items-center gap-1 px-2 py-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded text-amber-300 active:scale-95 transition-transform"
                title="Энергия для боя и переходов"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                <span className="text-xs font-mono font-bold">
                  {player.energy ?? 100}/{player.maxEnergy ?? 100}
                </span>
                <Plus className="w-3 h-3 text-amber-300 bg-amber-600/40 rounded-full" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={handleToggleSound}
                aria-label="Переключить звук"
                className="w-8 h-8 rounded bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-90 transition-transform"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>

              {/* Admin shortcut */}
              <button
                onClick={onOpenAdmin}
                aria-label="Админ Панель"
                className="w-8 h-8 rounded bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-300 hover:text-purple-100 active:scale-90 transition-transform"
              >
                <ShieldAlert className="w-4 h-4 text-purple-400" />
              </button>
            </div>
          </div>

          {/* Currency Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
            {/* Gold */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-amber-500/20 text-amber-300">
              <span>🪙</span>
              <span className="font-bold">{player.gold >= 10000 ? `${(player.gold / 1000).toFixed(1)}k` : player.gold}</span>
            </div>

            {/* Silver */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-slate-400/20 text-slate-300">
              <span>🥈</span>
              <span className="font-bold">{player.silver ?? 150}</span>
            </div>

            {/* Shards */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-cyan-500/20 text-cyan-300">
              <span>💠</span>
              <span className="font-bold">{player.shards ?? 15}</span>
            </div>

            {/* Crystals */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/60 rounded border border-purple-500/20 text-purple-300">
              <span>💎</span>
              <span className="font-bold">{player.crystals}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Energy Modal */}
      {showEnergyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e1422] border border-amber-500/40 rounded-xl p-5 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowEnergyModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce" />
              <h3 className="font-cinzel text-lg font-bold text-amber-300">Энергия странника</h3>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Энергия расходуется на вступление в бой и переходы между регионами. Она восстанавливается автоматически со временем (+1 каждые 5 сек).
            </p>

            <div className="mb-4 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">Текущий запас:</span>
                <span className="text-amber-300 font-bold">{player.energy ?? 100} / {player.maxEnergy ?? 100} ⚡</span>
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
                  <span>Быстрая медитация</span>
                </div>
                <span className="text-amber-300 font-mono">+25 ⚡ (Бесплатно)</span>
              </button>

              <button
                onClick={() => {
                  meditateOrRefillEnergy('silver');
                  setShowEnergyModal(false);
                }}
                disabled={(player.silver ?? 0) < 50}
                className="w-full py-2 px-3 rounded-lg bg-amber-950/70 hover:bg-amber-900 disabled:opacity-50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>🧪</span>
                  <span>Купить Эликсир Бодрости</span>
                </div>
                <span className="text-slate-200 font-mono">+50 ⚡ (50 🥈)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
