import React from 'react';
import { useGame } from '../../context/GameContext';
import { Moon, Coins, Zap, Skull, Package, Check } from 'lucide-react';
import { sound } from '../../utils/audio';

export const OfflineReportModal: React.FC = () => {
  const { offlineReport, dismissOfflineReport } = useGame();

  if (!offlineReport) return null;

  const hours = Math.floor(offlineReport.minutes / 60);
  const mins = offlineReport.minutes % 60;
  const timeStr = hours > 0 ? `${hours}ч ${mins}м` : `${mins} минут`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-cyan-500/40 bg-[#0a0f1d] p-5 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-400 text-cyan-300 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950">
          <Moon className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
            Офлайн-добыча
          </span>
          <h3 className="font-cinzel text-lg font-bold text-slate-100">
            Возвращение героя
          </h3>
          <p className="text-xs text-slate-400">
            Пока вас не было ({timeStr}), ваш персонаж продолжал охоту в землях Аэтельгарда.
          </p>
        </div>

        {/* Breakdown Card */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              <span>Убито монстров:</span>
            </span>
            <span className="text-slate-100 font-bold">{offlineReport.kills}</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Золото:</span>
            </span>
            <span className="text-amber-300 font-bold">+{offlineReport.gold} 🪙</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Опыт:</span>
            </span>
            <span className="text-cyan-300 font-bold">+{offlineReport.exp} EXP</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-purple-400" />
              <span>Трофеев получено:</span>
            </span>
            <span className="text-purple-300 font-bold">+{offlineReport.itemsCount} шт.</span>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playVictory();
            dismissOfflineReport();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-cinzel font-bold text-xs shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>Забрать награду</span>
        </button>
      </div>
    </div>
  );
};
