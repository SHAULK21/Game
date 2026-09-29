import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MINING_NODES } from '../../data/gameData';
import { Pickaxe, Sparkles, Zap, Flame, CheckCircle2 } from 'lucide-react';
import { sound } from '../../utils/audio';
import { RpgIcon } from '../ui/RpgIcon';

export const MiningScreen: React.FC = () => {
  const { player, mineNode } = useGame();
  const [activeMiningNodeId, setActiveMiningNodeId] = useState<string | null>(null);
  const [miningLog, setMiningLog] = useState<string[]>([]);
  const [isMining, setIsMining] = useState<boolean>(false);

  if (!player) return null;

  const handleMine = (nodeId: string) => {
    if (isMining) return;
    setIsMining(true);
    setActiveMiningNodeId(nodeId);

    setTimeout(() => {
      const res = mineNode(nodeId);
      if (res.success) {
        if (res.isCrit) {
          setMiningLog(prev => [
            `⚡ КРИТИЧЕСКАЯ ДОБЫЧА! Вы добыли ${res.yieldCount} ед. [${res.oreName}]!`,
            ...prev.slice(0, 8)
          ]);
        } else {
          setMiningLog(prev => [
            `⛏️ Вы успешно добыли ${res.yieldCount} ед. [${res.oreName}].`,
            ...prev.slice(0, 8)
          ]);
        }
      } else {
        setMiningLog(prev => [
          `❌ Не удалось добыть ${res.oreName || 'руду'}: недостаточно выносливости, уровень или место в сумке.`,
          ...prev.slice(0, 8)
        ]);
      }
      setIsMining(false);
      setActiveMiningNodeId(null);
    }, 600);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#18110b] to-[#0a0f1d] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/40 text-amber-400">
              <Pickaxe className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">
                Королевские Рудники
              </h2>
              <div className="text-[11px] font-mono text-slate-400">
                Уровень горного дела: <span className="text-amber-300 font-bold">{player.miningLevel}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">Опыт шахтера:</span>
            <span className="text-xs font-mono text-amber-300 font-bold">{player.miningExp} EXP</span>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              Выносливость: <span className="text-emerald-300 font-bold">{player.stamina}/{player.maxStamina}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Live Mining Feedback */}
      {miningLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#070912] p-2.5 space-y-1 font-mono text-[11px]">
          {miningLog.map((log, idx) => (
            <div key={idx} className={log.includes('КРИТИЧЕСКАЯ') ? 'text-amber-300 font-bold' : 'text-slate-300'}>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Mining Nodes Grid */}
      <div className="space-y-2">
        <div className="text-xs font-mono text-amber-400 uppercase tracking-wider px-1">
          Доступные жилы руды:
        </div>

        <div className="space-y-2">
          {MINING_NODES.map(node => {
            const isLocked = player.miningLevel < node.levelReq;
            const isCurrentlyMining = isMining && activeMiningNodeId === node.id;

            return (
              <div
                key={node.id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                  isLocked
                    ? 'border-slate-800/60 bg-slate-950/40 opacity-60'
                    : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-slate-900 rounded-lg border border-slate-800"><RpgIcon kind="ore" size={28} className="text-amber-300" /></span>
                  <div>
                    <span className="font-cinzel text-xs font-bold text-slate-100">
                      {node.name}
                    </span>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Добыча: {node.oreYield} (x{node.baseYieldMin}-{node.baseYieldMax}) · ⚡{node.staminaCost}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-400/80 mt-0.5">
                      ⛏ → Кузница · руда нужна для заточки
                    </div>
                  </div>
                </div>

                <div>
                  {isLocked ? (
                    <span className="text-[10px] font-mono text-rose-400 font-bold">
                      Треб. ур. {node.levelReq}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleMine(node.id)}
                      disabled={isMining}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-xs text-slate-950 active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Pickaxe className={`w-3.5 h-3.5 ${isCurrentlyMining ? 'animate-spin' : ''}`} />
                      <span>{isCurrentlyMining ? 'Добыча...' : 'Добывать'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
