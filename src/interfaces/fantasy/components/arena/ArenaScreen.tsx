import { AscensionArena } from './AscensionArena';
import { PvpArena } from './PvpArena';
import { nextArenaReset } from '../../../../utils/gameCadence';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { ARENA_BOTS } from '../../../../data/gameData';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ResourceBadge, SectionTitle } from '../ui/BestiaryUI';

interface ArenaScreenProps {
  onEnterCombatTab?: () => void;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ onEnterCombatTab }) => {
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
    <FolioPage className="space-y-3 pt-3">
      <div role="tablist" className="grid grid-cols-3 gap-2">{(['ascension','pve','pvp'] as const).map(m=><button key={m} role="tab" aria-selected={mode===m} onClick={()=>setMode(m)} className={`min-h-11 rounded-lg border px-1 text-xs ${mode===m?'border-[#9d8459] bg-[#302c24] text-amber-200':'border-slate-800 bg-slate-950 text-slate-400'}`}>{m==='ascension'?'Вознесение':m==='pve'?'Тренировка':'PvP — игроки'}</button>)}</div>
      {mode === 'ascension' ? <AscensionArena onEnterCombatTab={onEnterCombatTab}/> : mode === 'pvp' ? <PvpArena /> : <>
      <p title="В 00:00 UTC запас пополняется до 5; лишние билеты сохраняются. С боссов: 25% шанс билета, до 3 в сутки." className="line-clamp-2 text-xs text-slate-400">В 00:00 UTC запас пополняется до 5; лишние билеты сохраняются. С боссов: 25% шанс билета, до 3 в сутки.</p>
      {/* Header Banner */}
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#665940] bg-[#111416] text-[#c7a365]">
              <RpgIcon kind="arena" size={25} />
            </div>
            <div>
              <div className="text-[11px] font-mono text-yellow-400 uppercase">Бои против гладиаторов</div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">
                Колизей Чемпионов
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-400 block">Билеты арены:</span>
            <ResourceBadge kind="arena" value={`${player.arenaTickets} · ежедневно до 5`} />
            <span className="text-[11px] text-slate-400 block">Обновление: {new Date(nextArenaReset()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · 00:00 UTC</span>
          </div>
        </div>

        {/* Player League Rating Card */}
        <div className="mt-3.5 bg-slate-950/80 p-3 rounded-xl border border-yellow-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RpgIcon kind="crown" size={24} className="text-yellow-400" />
            <div>
              <div className="text-xs font-bold text-slate-100">
                Лига: <span className="text-yellow-400">{player.arenaLeague}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Рейтинг: <span className="text-[#d5ba89] font-bold">{player.arenaRating}</span> PTS
              </div>
              <div className="text-[11px] text-emerald-400">Победа: +25 PTS · Поражение: −15 PTS</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">Тренировочная арена</span>
            <span className="text-[11px] text-slate-400 block">PvP имеет отдельный рейтинг</span>
          </div>
        </div>
      </BestiaryPanel>

      {/* Opponents Selection */}
      <div className="space-y-2.5">
        {fightError && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">{fightError}</p>}
        <SectionTitle eyebrow="Гладиаторы">Доступные соперники</SectionTitle>
        <div className="flex justify-end px-1">
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-800 bg-slate-900"><RpgIcon kind="character" size={22} className="text-[#a48b60]" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {opp.name}
                      </span>
                      <span className="text-[11px] font-mono text-yellow-400 px-1 bg-yellow-950/60 rounded border border-yellow-600/30">
                        {opp.league}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1 mt-0.5">
                      <span>Ур. {opp.level}</span>
                      <span>·</span>
                      <span>Мощь: <span className="text-amber-300 font-bold">{opp.powerRating}</span></span>
                      <span>·</span>
                      <span>{opp.rating} PTS</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={player.arenaTickets<1}
                  onClick={() => handleChallenge(opp)}
                  className="rpg-button rpg-button-primary ml-2 min-h-11 shrink-0 px-3 disabled:opacity-40"
                >
                  <RpgIcon kind="attack" size={16} />
                  <span>В бой</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      </>}
    </FolioPage>
  );
};
