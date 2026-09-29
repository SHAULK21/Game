import React from 'react';
import { useGame } from '../../context/GameContext';
import { Moon, Package, Check, Crown } from 'lucide-react';
import { sound } from '../../utils/audio';

export const OfflineReportModal: React.FC = () => {
  const { offlineReport, dismissOfflineReport } = useGame();

  if (!offlineReport) return null;

  const hours = Math.floor(offlineReport.minutes / 60);
  const mins = offlineReport.minutes % 60;
  const timeStr = hours > 0 ? `${hours}ч ${mins}м` : `${mins} минут`;
  const miningRewards = offlineReport.miningRewards || [];
  const totalResources = miningRewards.reduce((sum, reward) => sum + reward.count, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-500/40 bg-[#0a0f1d] p-5 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-yellow-950/80 border border-yellow-400 text-yellow-300 flex items-center justify-center mx-auto shadow-lg shadow-yellow-950">
          <Moon className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest flex items-center justify-center gap-1">
            <Crown className="w-3 h-3" /> Premium офлайн-добыча
          </span>
          <h3 className="font-cinzel text-lg font-bold text-slate-100">Шахтёры вернулись</h3>
          <p className="text-xs text-slate-400">
            Пока вас не было ({timeStr}), Premium автоматически собирал доступные по вашему уровню ресурсы.
          </p>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono text-left">
          {miningRewards.length > 0 ? (
            <>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  Всего ресурсов
                </span>
                <span className="text-purple-300 font-bold">×{totalResources}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {miningRewards.map(reward => (
                  <div key={reward.name} className="rounded-lg border border-slate-800 bg-black/20 p-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-lg shrink-0">{reward.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-200 leading-tight break-words">{reward.name}</div>
                        <div className="text-[9px] text-emerald-300 font-bold">×{reward.count}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-[11px] text-rose-300">
              Рюкзак был заполнен, поэтому автоматическую добычу сохранить не удалось.
            </div>
          )}
        </div>

        <button
          onClick={() => {
            sound.playVictory();
            dismissOfflineReport();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-500 text-slate-950 font-cinzel font-bold text-xs shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>Понятно</span>
        </button>
      </div>
    </div>
  );
};
