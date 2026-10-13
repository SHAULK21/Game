import {WorldExplorer} from '../../../../components/world/WorldExplorer';
import type {GameTabId} from '../../../../types/navigation';
import {t as localize,useLocale} from '../../../../i18n/locale';
import React from 'react';
import {useGame} from '../../../../context/GameContext';
import {ASSETS} from '../../data/gameData';
import {BestiaryPanel,FolioPage} from '../ui/BestiaryUI';
import {RpgIcon} from '../ui/RpgIcon';

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
      <div className="world-travel-overlay fantasy-travel-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
        <section role="dialog" aria-modal="true" aria-labelledby="fantasy-travel-title" className={`fantasy-travel-leaf quest-book${travelState.isAmbush ? ' is-ambush' : ''}`}>
          <div className="travel-seal"><RpgIcon kind={travelState.isAmbush ? 'skill' : 'map'} size={40} /></div>
          <h3 id="fantasy-travel-title">{travelState.isAmbush ? localize('ВНЕЗАПНАЯ ЗАСАДА!') : localize('Путь в: {0}').replace('{0}', localize(travelState.targetRegionName))}</h3>
          <p className="travel-message" role="status">{localize(travelState.message)}</p>
          <div className="travel-progress" role="progressbar" aria-label={localize("Прогресс перехода")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={travelState.progress}>
            <span style={{ width: `${travelState.progress}%` }} />
          </div>
          <div className="travel-progress-caption"><span>{localize("Прогресс перехода")}</span><strong>{localize(travelState.progress)}%</strong></div>
        </section>
      </div>
    );
  }

  // 2. PROCEDURAL DUNGEON ACTIVE RUN VIEW
  if (activeDungeonRun) {
    const currentRoom = activeDungeonRun.rooms[activeDungeonRun.currentRoomIndex];
    const isCompleted = activeDungeonRun.completed;

    return (
      <FolioPage className="world-codex space-y-3 pt-3">
        <BestiaryPanel className="flex items-center justify-between rounded-xl p-3">
          <div>
            <div className="text-[11px] font-mono text-[#d5ba89] uppercase">{localize("Подземелье")}</div>
            <h2 className="font-cinzel text-sm font-bold text-slate-100">{localize(activeDungeonRun.dungeonName)}</h2>
            <div className="text-[11px] text-[#d5ba89]">{localize("Побед: ")}{localize(activeDungeonRun.kills || 0)} · HP {localize(activeDungeonRun.savedHp ?? combatStats.maxHp)} · MP {localize(activeDungeonRun.savedMp ?? combatStats.maxMp)}</div>
          </div>
          <button
            onClick={() => { if (window.confirm(localize('Покинуть подземелье? Прогресс этого захода будет потерян.'))) exitDungeon(); }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >{localize("Покинуть")}</button>
        </BestiaryPanel>

        {activeDungeonRun.lastEvent && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{localize(activeDungeonRun.lastEvent)}</p>}
        {activeDungeonRun.temporaryBlessing && <BestiaryPanel className="p-3 text-xs text-[#cdbb91]">{localize(activeDungeonRun.temporaryBlessing.name)}{localize(": +10% к физической и магической атаке и защите. Осталось побед: ")}{localize(activeDungeonRun.temporaryBlessing.remainingBattles)}.</BestiaryPanel>}

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
          <BestiaryPanel className="space-y-4 p-6 text-center">
            <RpgIcon kind="crown" size={46} className="mx-auto text-[#c7a365]" />
            <h3 className="font-cinzel text-lg font-bold text-slate-100">{localize("Подземелье успешно зачищено!")}</h3>
            <p className="text-xs text-slate-300">{localize("Все комнаты пройдены, а босс повержен.")}</p>
            {activeDungeonRun.completionReward && <div className="rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs text-amber-200 space-y-1">
              <div className="font-bold">{localize("Награда за прохождение зачислена")}</div>
              <div>+{localize(activeDungeonRun.completionReward.gold)}{localize(" золота · +")}{localize(activeDungeonRun.completionReward.silver)}{localize(" серебра · +")}{localize(activeDungeonRun.completionReward.exp)}{localize(" опыта")}</div>
              <div className="text-[11px] text-slate-400">{localize("Дополнительно к добыче с босса. Повторное открытие итогов не выдаёт награду повторно.")}</div>
            </div>}
            <button
              onClick={exitDungeon}
              className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all"
            >{localize("Вернуться в город")}</button>
          </BestiaryPanel>
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
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-[#d5ba89] text-[11px] font-mono">{localize("Комната ")}{localize(activeDungeonRun.currentRoomIndex + 1)}{localize(" из ")}{localize(activeDungeonRun.totalRooms)}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <RpgIcon kind={currentRoom.type === 'boss' ? 'crown' : currentRoom.type === 'treasure' ? 'gold' : currentRoom.type === 'shrine' ? 'skill' : 'attack'} size={21} />
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
                    <RpgIcon kind="attack" size={17} />
                    <span>{localize("Сразиться с врагом")}</span>
                  </button>
                ) : currentRoom.type === 'treasure' ? (
                  <button
                    onClick={() => proceedDungeonRoom('open')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <RpgIcon kind="gold" size={17} />
                    <span>{localize("Открыть сундук · 25% пустой")}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => proceedDungeonRoom('pray')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <RpgIcon kind="skill" size={17} />
                    <span>{localize("Получить благословение · шанс 70%")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </FolioPage>
    );
  }

  return <WorldExplorer onEnterCombatTab={onEnterCombatTab} onNavigate={onNavigate}/>;
};
