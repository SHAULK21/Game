import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { AscensionArena } from './AscensionArena';
import { PvpArena } from './PvpArena';
import { nextArenaReset } from '../../utils/gameCadence';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ARENA_BOTS } from '../../data/gameData';
import { Trophy, Swords, Crown } from 'lucide-react';

interface ArenaScreenProps {
  onEnterCombatTab?: () => void;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ onEnterCombatTab }) => {
  useLocale();
  const { player, premium, activeDungeonRun, isInCombat, isCombatEnded, challengeArena } = useGame();
  const [mode,setMode] = useState<'ascension'|'pve'|'pvp'>('ascension');
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
      <div className="grid grid-cols-3 gap-2">{(['ascension','pve','pvp'] as const).map(m=><button key={m} onClick={()=>setMode(m)} className={`rounded-xl p-3 text-xs border ${mode===m?'bg-amber-950 text-amber-200':'bg-slate-950 text-slate-400'}`}>{localize(m==='ascension'?'Вознесение':m==='pve'?'Тренировка':'PvP — игроки')}</button>)}</div>
      {mode === 'ascension' ? <AscensionArena onEnterCombatTab={onEnterCombatTab}/> : mode === 'pvp' ? <PvpArena /> : <>
      <p className="text-xs text-slate-400">{localize("В 00:00 UTC запас пополняется до 5; лишние билеты сохраняются. С боссов: 25% шанс билета, до 3 в сутки.")}</p>
      {/* Header Banner */}
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-yellow-950/60 border border-yellow-400/40 text-yellow-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-yellow-400 uppercase">{localize("Бои против гладиаторов")}</div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">{localize("Колизей Чемпионов")}</h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">{localize("Билеты арены:")}</span>
            <span className="text-xs font-mono font-bold text-yellow-300">
              🎟️ {localize(player.arenaTickets)}{localize(" (ежедневно до 5)")}</span>
            <span className="text-[10px] text-slate-400 block">{localize("Обновление: ")}{localize(new Date(nextArenaReset()).toLocaleTimeString(intlLocale(), {hour:'2-digit',minute:'2-digit'}))} · 00:00 UTC</span>
          </div>
        </div>

        {/* Player League Rating Card */}
        <div className="mt-3.5 bg-slate-950/80 p-3 rounded-xl border border-yellow-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-yellow-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">{localize("Лига: ")}<span className="text-yellow-400">{localize(player.arenaLeague)}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">{localize("Рейтинг: ")}<span className="text-[#d5ba89] font-bold">{localize(player.arenaRating)}</span> PTS
              </div>
              <div className="text-[10px] text-emerald-400">{localize("Победа: +25 PTS · Поражение: −15 PTS")}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">{localize("Тренировочная арена")}</span>
            <span className="text-[10px] text-slate-400 block">{localize("PvP имеет отдельный рейтинг")}</span>
          </div>
        </div>
      </div>

      {/* Opponents Selection */}
      <div className="space-y-2.5">
        {fightError && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">{localize(fightError)}</p>}
        <div className="flex items-center justify-between px-1">
          <span className="font-cinzel text-xs font-bold text-slate-300 uppercase tracking-wider">{localize("Доступные соперники")}</span>
          <span className="text-[11px] text-slate-400">{localize("Обновление через 15м")}</span>
        </div>

        <div className="space-y-2">
          {ARENA_BOTS.map(opp => {
            return (
              <div
                key={opp.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] hover:border-slate-700 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                    {localize(opp.avatar)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {localize(opp.name)}
                      </span>
                      <span className="text-[10px] font-mono text-yellow-400 px-1 bg-yellow-950/60 rounded border border-yellow-600/30">
                        {localize(opp.league)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1 mt-0.5">
                      <span>{localize("Ур. ")}{localize(opp.level)}</span>
                      <span>·</span>
                      <span>{localize("Мощь: ")}<span className="text-amber-300 font-bold">{localize(opp.powerRating)}</span></span>
                      <span>·</span>
                      <span>{localize(opp.rating)} PTS</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={player.arenaTickets<1}
                  onClick={() => handleChallenge(opp)}
                  className="ui-primary shrink-0 ml-2 min-h-11 px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>{localize("В бой")}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      </>}
    </div>
  );
};
