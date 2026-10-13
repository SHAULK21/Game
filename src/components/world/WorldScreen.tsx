import {WorldExplorer} from './WorldExplorer';
import type {GameTabId} from '../../types/navigation';
import {t as localize,useLocale} from '../../i18n/locale';
import React from 'react';
import {useGame} from '../../context/GameContext';
import {ASSETS} from '../../data/gameData';
import {Skull,Sparkles,Crown,Key,AlertTriangle,Footprints} from 'lucide-react';

interface WorldScreenProps {
  onEnterCombatTab?: () => void;
  onNavigate?: (tab:GameTabId) => void;
}

export const WorldScreen: React.FC<WorldScreenProps> = ({ onEnterCombatTab,onNavigate }) => {
  useLocale();
  const {
    player,
    combatStats,
    activeDungeonRun,
    travelState,
    proceedDungeonRoom,
    exitDungeon,
  } = useGame();

  if (!player) return null;

  // 1. TRAVEL OVERLAY MODAL (Journey & Ambush)
  if (travelState.isTraveling) {
    return (
      <div className="world-travel-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
        <div className={`max-w-sm w-full rounded-2xl p-6 border text-center  transition-all ${
          travelState.isAmbush 
            ? 'bg-rose-950/80 border-rose-500'
            : 'bg-[#0b101c] border-cyan-500/40 '
        }`}>
          {/* Animated Journey Icon */}
          <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            {travelState.isAmbush ? (
              <div className="p-4 rounded-full bg-rose-900/60 border border-rose-500">
                <AlertTriangle className="w-10 h-10 text-rose-300" />
              </div>
            ) : (
              <div className="p-4 rounded-full bg-cyan-950/60 border border-cyan-400">
                <Footprints className="w-10 h-10 text-[#d5ba89]" />
              </div>
            )}
          </div>

          <h3 className="font-cinzel text-lg font-bold text-slate-100 mb-1">
            {localize(travelState.isAmbush ? 'ВНЕЗАПНАЯ ЗАСАДА!' : `Путь в: ${travelState.targetRegionName}`)}
          </h3>

          <p className="text-xs text-slate-300 mb-5 leading-relaxed min-h-[36px]">
            {localize(travelState.message)}
          </p>

          {/* Travel Progress Bar */}
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-700 mb-3">
            <div
              className={`h-full transition-all duration-300 ${
                travelState.isAmbush 
                  ? 'bg-gradient-to-r from-rose-600 to-amber-500' 
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
              }`}
              style={{ width: `${travelState.progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span>{localize("Прогресс перехода")}</span>
            <span className="text-[#d5ba89] font-bold">{localize(travelState.progress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. PROCEDURAL DUNGEON ACTIVE RUN VIEW
  if (activeDungeonRun) {
    const currentRoom = activeDungeonRun.rooms[activeDungeonRun.currentRoomIndex];
    const isCompleted = activeDungeonRun.completed;

    return (
      <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700 rounded-xl p-3">
          <div>
            <div className="text-[10px] font-mono text-[#d5ba89] uppercase">{localize("Подземелье")}</div>
            <h2 className="font-cinzel text-sm font-bold text-slate-100">{localize(activeDungeonRun.dungeonName)}</h2>
            <div className="text-[10px] text-[#d5ba89]">{localize("Побед: ")}{localize(activeDungeonRun.kills || 0)} · HP {localize(activeDungeonRun.savedHp ?? combatStats.maxHp)} · MP {localize(activeDungeonRun.savedMp ?? combatStats.maxMp)}</div>
          </div>
          <button
            onClick={() => { if (window.confirm(localize('Покинуть подземелье? Прогресс этого захода будет потерян.'))) exitDungeon(); }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >{localize("Покинуть")}</button>
        </div>

        {activeDungeonRun.lastEvent && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{localize(activeDungeonRun.lastEvent)}</p>}
        {activeDungeonRun.temporaryBlessing && <p className="rounded-xl border border-slate-700 p-3 text-xs text-cyan-200">✨ {localize(activeDungeonRun.temporaryBlessing.name)}{localize(": +10% к физической и магической атаке и защите. Осталось побед: ")}{localize(activeDungeonRun.temporaryBlessing.remainingBattles)}{localize(". Действует только в этом походе.")}</p>}

        {/* Room Stepper */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {activeDungeonRun.rooms.map((r, idx) => {
            const isCurrent = idx === activeDungeonRun.currentRoomIndex;
            const isDone = idx < activeDungeonRun.currentRoomIndex;
            return (
              <div
                key={r.id}
                className={`flex-1 min-w-[28px] h-2 rounded-full transition-all ${
                  isCurrent
                    ? 'bg-cyan-400 shadow-sm '
                    : isDone
                    ? 'bg-emerald-500'
                    : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {/* Active Room Card */}
        {isCompleted ? (
          <div className="ui-panel rounded-2xl border p-6 text-center space-y-4">
            <Crown className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="font-cinzel text-lg font-bold text-slate-100">{localize("Подземелье успешно зачищено!")}</h3>
            <p className="text-xs text-slate-300">{localize("Все комнаты пройдены, а босс повержен.")}</p>
            {activeDungeonRun.completionReward && <div className="rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs text-amber-200 space-y-1">
              <div className="font-bold">{localize("Награда за прохождение зачислена")}</div>
              <div>+{localize(activeDungeonRun.completionReward.gold)}{localize(" золота · +")}{localize(activeDungeonRun.completionReward.silver)}{localize(" серебра · +")}{localize(activeDungeonRun.completionReward.exp)}{localize(" опыта")}</div>
              <div className="text-[10px] text-slate-400">{localize("Дополнительно к добыче с босса. Повторное открытие итогов не выдаёт награду повторно.")}</div>
            </div>}
            <button
              onClick={exitDungeon}
              className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all"
            >{localize("Вернуться в город")}</button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0f1d]">
            <div className="relative h-40 w-full overflow-hidden">
              <img
                src={ASSETS.dungeonCave}
                alt="Cave"
                className="w-full h-full object-cover brightness-75"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-transparent to-transparent" />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-[#d5ba89] text-[10px] font-mono">{localize("Комната ")}{localize(activeDungeonRun.currentRoomIndex + 1)}{localize(" из ")}{localize(activeDungeonRun.totalRooms)}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {localize(currentRoom.type === 'boss' ? '👑' : currentRoom.type === 'treasure' ? '🎁' : currentRoom.type === 'shrine' ? '✨' : '⚔️')}
                </span>
                <h3 className="font-cinzel text-base font-bold text-slate-100">
                  {localize(currentRoom.title)}
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {localize(currentRoom.description)}
              </p>

              <div className="pt-2">
                {currentRoom.type === 'combat' || currentRoom.type === 'boss' || currentRoom.type === 'elite' ? (
                  <button
                    onClick={() => {
                      if (proceedDungeonRoom('fight')) onEnterCombatTab?.();
                    }}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Skull className="w-4 h-4" />
                    <span>{localize("Сразиться с врагом")}</span>
                  </button>
                ) : currentRoom.type === 'treasure' ? (
                  <button
                    onClick={() => proceedDungeonRoom('open')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>{localize("Открыть сундук · 25% пустой")}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => proceedDungeonRoom('pray')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{localize("Получить благословение · шанс 70%")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <WorldExplorer onEnterCombatTab={onEnterCombatTab} onNavigate={onNavigate}/>;
};
