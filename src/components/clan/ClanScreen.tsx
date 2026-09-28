import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ShieldCheck, Users, Coins, Sparkles, Swords, Crown } from 'lucide-react';
import { sound } from '../../utils/audio';

export const ClanScreen: React.FC = () => {
  const { player } = useGame();
  const [treasury, setTreasury] = useState(185000);
  const [bossHp, setBossHp] = useState(84000);
  const maxBossHp = 120000;
  const [donateSuccess, setDonateSuccess] = useState(false);

  if (!player) return null;

  const handleDonate = () => {
    if (player.gold < 500) return;
    player.gold -= 500;
    setTreasury(prev => prev + 500);
    sound.playVictory();
    setDonateSuccess(true);
    setTimeout(() => setDonateSuccess(false), 2000);
  };

  const handleAttackRaidBoss = () => {
    const dmg = 450 + Math.floor(Math.random() * 200);
    setBossHp(prev => Math.max(0, prev - dmg));
    sound.playCriticalHit();
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-[#091225] via-[#090e1c] to-[#07090e] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-400/40 text-blue-300">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-blue-400 font-mono font-bold text-xs">[NEXUS]</span>
                <h2 className="font-cinzel text-base font-bold text-slate-100">Орден Затмения</h2>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Уровень клана: <span className="text-cyan-300 font-bold">5</span> · 28/35 участников
              </div>
            </div>
          </div>

          <button
            onClick={handleDonate}
            className="px-2.5 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-500/40 text-[11px] font-bold text-blue-200 active:scale-95 transition-all"
          >
            + Внести 500 🪙
          </button>
        </div>

        {donateSuccess && (
          <div className="mt-2 text-[11px] text-emerald-400 font-mono text-center">
            Спасибо! Вы внесли 500 золота в казну ордена!
          </div>
        )}
      </div>

      {/* Clan Perks */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 space-y-2">
        <span className="font-cinzel text-xs font-bold text-cyan-300 uppercase tracking-wider block">
          Активные бонусы клана:
        </span>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-amber-400 font-bold">+10%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Опыт за бои</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-yellow-400 font-bold">+8%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Добыча золота</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-cyan-400 font-bold">+5%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Шанс крита</div>
          </div>
        </div>
      </div>

      {/* Clan Raid Boss */}
      <div className="rounded-2xl border border-purple-500/40 bg-[#0c0d1c] p-3.5 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👹</span>
            <div>
              <div className="text-xs font-bold text-slate-100 font-cinzel">
                Клановый Рейд: Колосс Пустоты
              </div>
              <div className="text-[10px] font-mono text-purple-300">
                Сброс рейда через: 2д 14ч
              </div>
            </div>
          </div>

          <button
            onClick={handleAttackRaidBoss}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs active:scale-95 transition-all flex items-center gap-1 shadow-sm"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Удар по рейду</span>
          </button>
        </div>

        {/* Boss HP Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-purple-300 font-bold">HP Рейд-Босса</span>
            <span className="text-slate-300 tabular-nums">
              {bossHp} / {maxBossHp} ({Math.round((bossHp / maxBossHp) * 100)}%)
            </span>
          </div>
          <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-purple-950">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-rose-500 transition-all duration-300"
              style={{ width: `${(bossHp / maxBossHp) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
