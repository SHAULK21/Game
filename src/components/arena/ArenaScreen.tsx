import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ARENA_BOTS } from '../../data/gameData';
import { Trophy, Swords, Crown } from 'lucide-react';

interface ArenaScreenProps {
  onEnterCombatTab?: () => void;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ onEnterCombatTab }) => {
  const { player, premium, activeDungeonRun, isInCombat, isCombatEnded, challengeArena } = useGame();
  const [fightError, setFightError] = useState<string | null>(null);

  if (!player) return null;

  const handleChallenge = (opponent: (typeof ARENA_BOTS)[number]) => {
    setFightError(null);
    if (isInCombat && !isCombatEnded) {
      onEnterCombatTab?.();
      return;
    }
    if (activeDungeonRun) {
      setFightError('Завершите текущий поход в подземелье перед боем на Арене.');
      return;
    }
    if (player.miningExpedition && !premium.active) {
      setFightError('Персонаж сейчас в шахте. Сначала нажмите «Уйти с шахты».');
      return;
    }
    if (player.arenaTickets <= 0) {
      setFightError('Билеты закончились. Они восстановятся завтра в 00:00 UTC.');
      return;
    }
    if (challengeArena(opponent)) onEnterCombatTab?.();
    else setFightError('Не удалось начать бой. Попробуйте ещё раз.');
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header Banner */}
      <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-[#181408] via-[#0f1118] to-[#07090e] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-yellow-950/60 border border-yellow-400/40 text-yellow-300">
              <Trophy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-yellow-400 uppercase">Рейтинговый сезон I</div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">
                Колизей Чемпионов
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">Билеты арены:</span>
            <span className="text-xs font-mono font-bold text-yellow-300">
              🎟️ {player.arenaTickets} / 5
            </span>
            <span className="text-[10px] text-slate-400 block">Восстановление: 00:00 UTC</span>
          </div>
        </div>

        {/* Player League Rating Card */}
        <div className="mt-3.5 bg-slate-950/80 p-3 rounded-xl border border-yellow-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-yellow-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">
                Лига: <span className="text-yellow-400">{player.arenaLeague}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Рейтинг: <span className="text-cyan-300 font-bold">{player.arenaRating}</span> PTS
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">Сезон: 24 дня</span>
            <span className="text-[10px] text-slate-400 block">Награда: 5,000 🪙</span>
          </div>
        </div>
      </div>

      {/* Opponents Selection */}
      <div className="space-y-2.5">
        {fightError && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">{fightError}</p>}
        <div className="flex items-center justify-between px-1">
          <span className="font-cinzel text-xs font-bold text-slate-300 uppercase tracking-wider">
            Доступные соперники
          </span>
          <span className="text-[11px] text-slate-400">
            Обновление через 15м
          </span>
        </div>

        <div className="space-y-2">
          {ARENA_BOTS.map(opp => {
            return (
              <div
                key={opp.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] hover:border-slate-700 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                    {opp.avatar}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {opp.name}
                      </span>
                      <span className="text-[10px] font-mono text-yellow-400 px-1 bg-yellow-950/60 rounded border border-yellow-600/30">
                        {opp.league}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Ур. {opp.level}</span>
                      <span>·</span>
                      <span>Мощь: <span className="text-amber-300 font-bold">{opp.powerRating}</span></span>
                      <span>·</span>
                      <span>{opp.rating} PTS</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleChallenge(opp)}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-cinzel font-bold text-xs shadow-md shadow-yellow-950 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>В бой</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
