import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { REGIONS, CAVES, ASSETS, REGION_MODIFIERS } from '../../data/gameData';
import { 
  Compass, 
  MapPin, 
  Skull, 
  Flame, 
  Sparkles, 
  ChevronRight, 
  ArrowLeft,
  Crown,
  Key,
  Shield,
  Zap,
  AlertTriangle,
  Footprints,
  Clock
} from 'lucide-react';
import { sound } from '../../utils/audio';

interface WorldScreenProps {
  onEnterCombatTab?: () => void;
}

export const WorldScreen: React.FC<WorldScreenProps> = ({ onEnterCombatTab }) => {
  const {
    player,
    combatStats,
    activeDungeonRun,
    travelState,
    startTravel,
    enterDungeon,
    proceedDungeonRoom,
    exitDungeon,
    setActiveRegionMod,
    isInCombat,
    isCombatEnded,
    premium
  } = useGame();

  const [selectedCaveId, setSelectedCaveId] = useState<string>('cave_bat');
  const [difficulty, setDifficulty] = useState<'normal' | 'hard' | 'nightmare' | 'hell'>('normal');
  const [selectedRegionId, setSelectedRegionId] = useState<string>(player?.currentRegionId || 'reg_plains');
  const [selectedModId, setSelectedModId] = useState<string>(player?.activeRegionModId || 'mod_standard');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!player) return null;

  const currentRegion = REGIONS.find(r => r.id === player.currentRegionId) || REGIONS[0];
  const inspectingRegion = REGIONS.find(r => r.id === selectedRegionId) || currentRegion;
  const activeMod = REGION_MODIFIERS[selectedModId] || REGION_MODIFIERS.mod_standard;

  const handleStartTravel = (regId: string) => {
    setErrorMessage(null);
    const result = startTravel(regId, selectedModId);
    if (!result.success) {
      setErrorMessage(result.message);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // 1. TRAVEL OVERLAY MODAL (Journey & Ambush)
  if (travelState.isTraveling) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
        <div className={`max-w-sm w-full rounded-2xl p-6 border text-center shadow-2xl transition-all ${
          travelState.isAmbush 
            ? 'bg-rose-950/80 border-rose-500 shadow-rose-950 animate-pulse' 
            : 'bg-[#0b101c] border-cyan-500/40 shadow-cyan-950'
        }`}>
          {/* Animated Journey Icon */}
          <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            {travelState.isAmbush ? (
              <div className="p-4 rounded-full bg-rose-900/60 border border-rose-500 animate-bounce">
                <AlertTriangle className="w-10 h-10 text-rose-300" />
              </div>
            ) : (
              <div className="p-4 rounded-full bg-cyan-950/60 border border-cyan-400">
                <Footprints className="w-10 h-10 text-cyan-300 animate-pulse" />
              </div>
            )}
          </div>

          <h3 className="font-cinzel text-lg font-bold text-slate-100 mb-1">
            {travelState.isAmbush ? 'ВНЕЗАПНАЯ ЗАСАДА!' : `Путь в: ${travelState.targetRegionName}`}
          </h3>

          <p className="text-xs text-slate-300 mb-5 leading-relaxed min-h-[36px]">
            {travelState.message}
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
            <span>Прогресс перехода</span>
            <span className="text-cyan-300 font-bold">{travelState.progress}%</span>
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
        <div className="flex items-center justify-between bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3">
          <div>
            <div className="text-[10px] font-mono text-cyan-400 uppercase">Подземелье</div>
            <h2 className="font-cinzel text-sm font-bold text-slate-100">{activeDungeonRun.dungeonName}</h2>
            <div className="text-[10px] text-cyan-300">Побед: {activeDungeonRun.kills || 0} · HP {activeDungeonRun.savedHp ?? combatStats.maxHp} · MP {activeDungeonRun.savedMp ?? combatStats.maxMp}</div>
          </div>
          <button
            onClick={() => { if (window.confirm('Покинуть подземелье? Прогресс этого захода будет потерян.')) exitDungeon(); }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >
            Покинуть
          </button>
        </div>

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
                    ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
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
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/30 via-[#0a0f1d] to-[#07090e] p-6 text-center space-y-4 shadow-2xl">
            <Crown className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
            <h3 className="font-cinzel text-lg font-bold text-slate-100">
              Подземелье успешно зачищено!
            </h3>
            <p className="text-xs text-slate-300">
              Все комнаты пройдены, а босс повержен.
            </p>
            <button
              onClick={exitDungeon}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-cinzel font-bold text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              Вернуться в город
            </button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0f1d] shadow-xl">
            <div className="relative h-40 w-full overflow-hidden">
              <img
                src={ASSETS.dungeonCave}
                alt="Cave"
                className="w-full h-full object-cover brightness-75"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-transparent to-transparent" />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-cyan-300 text-[10px] font-mono">
                Комната {activeDungeonRun.currentRoomIndex + 1} из {activeDungeonRun.totalRooms}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {currentRoom.type === 'boss' ? '👑' : currentRoom.type === 'treasure' ? '🎁' : currentRoom.type === 'shrine' ? '✨' : '⚔️'}
                </span>
                <h3 className="font-cinzel text-base font-bold text-slate-100">
                  {currentRoom.title}
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {currentRoom.description}
              </p>

              <div className="pt-2">
                {currentRoom.type === 'combat' || currentRoom.type === 'boss' ? (
                  <button
                    onClick={() => {
                      proceedDungeonRoom('fight');
                      if (onEnterCombatTab) onEnterCombatTab();
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-cinzel font-bold text-xs shadow-md shadow-red-950 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Skull className="w-4 h-4" />
                    <span>Сразиться с врагом</span>
                  </button>
                ) : currentRoom.type === 'treasure' ? (
                  <button
                    onClick={() => proceedDungeonRoom('open')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-cinzel font-bold text-xs shadow-md shadow-amber-950 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>Открыть древний сундук</span>
                  </button>
                ) : (
                  <button
                    onClick={() => proceedDungeonRoom('pray')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-cinzel font-bold text-xs shadow-md shadow-cyan-950 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Получить благословение</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. MAIN WORLD EXPLORATION VIEW
  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header Banner */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#0c1322] to-[#07090e] p-4 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-400/40 text-cyan-300">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Карта Аэтельгарда
            </h2>
            <p className="text-xs text-slate-300">
              Выбирайте стартовые локации и активируйте особые модификаторы охоты.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Selected Region & Mode Control Card */}
      <div className="rounded-2xl border border-indigo-500/30 bg-[#090d18] p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-slate-900 rounded-xl border border-slate-800">
              {inspectingRegion.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-sm font-bold text-slate-100">
                  {inspectingRegion.name}
                </h3>
                {inspectingRegion.isStarter && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 text-[9px] font-mono font-bold">
                    СТАРТОВАЯ
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {inspectingRegion.levelRange} · {inspectingRegion.description}
              </div>
            </div>
          </div>
        </div>

        {/* Region Mode / Modifier Selector */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-cyan-400 mb-2">
            <span>Режим охоты (Моды локации):</span>
            <span className="text-[10px] text-amber-300">Расход: {activeMod.energyCost} ⚡</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(inspectingRegion.availableMods || ['mod_standard']).map(mId => {
              const mod = REGION_MODIFIERS[mId];
              if (!mod) return null;
              const isSelected = selectedModId === mod.id;

              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setSelectedModId(mod.id);
                    if (inspectingRegion.id === currentRegion.id) setActiveRegionMod(mod.id);
                    sound.playClick();
                  }}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'border-cyan-400 bg-cyan-950/60 shadow-sm shadow-cyan-400/20' 
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{mod.icon}</span>
                    <span className="font-cinzel text-[11px] font-bold text-slate-200 truncate">
                      {mod.name}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-tight">
                    Засада: {Math.round(mod.ambushChance * 100)}% · Дроп: x{mod.rareDropMultiplier}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Mode Description Box */}
          <div className="mt-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
            <span className="font-bold text-amber-300">{activeMod.name}: </span>
            {activeMod.description}
          </div>
        </div>

        {/* Travel / Action Button */}
        <div className="pt-2">
          {player.currentRegionId === inspectingRegion.id ? (
            <button
              onClick={() => {
                if (onEnterCombatTab) onEnterCombatTab();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-cinzel font-bold text-xs shadow-md shadow-emerald-950 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>⚔️ Перейти к охоте на монстров</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStartTravel(inspectingRegion.id)}
                disabled={player.level < inspectingRegion.minLevel}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 disabled:opacity-50 text-white font-cinzel font-bold text-xs shadow-md shadow-cyan-950 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Footprints className="w-4 h-4" />
                <span>Отправиться в путь (3 сек, {activeMod.energyCost} ⚡)</span>
              </button>
              {player.level < inspectingRegion.minLevel && (
                <p className="mt-2 text-center text-xs text-rose-300">Локация откроется на {inspectingRegion.minLevel}-м уровне. Сейчас её можно только посмотреть.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Regions List with Starter Locations Badge */}
      <div className="space-y-2">
        <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider px-1">
          Доступные локации и провинции:
        </div>

        <div className="space-y-2">
          {REGIONS.map(reg => {
            const isCurrent = player.currentRegionId === reg.id;
            const isInspecting = selectedRegionId === reg.id;
            const isLocked = player.level < reg.minLevel;

            return (
              <div
                key={reg.id}
                onClick={() => {
                  setSelectedRegionId(reg.id);
                  setSelectedModId(reg.id === currentRegion.id && reg.availableMods.includes(player.activeRegionModId || '')
                    ? player.activeRegionModId!
                    : reg.defaultModId);
                  sound.playClick();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isInspecting
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-950'
                    : isLocked
                    ? 'border-slate-800/60 bg-slate-950/40 opacity-60'
                    : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                      {reg.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-cinzel text-xs font-bold text-slate-100">
                          {reg.name}
                        </span>
                        {reg.isStarter && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold">
                            СТАРТ
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold">
                            ВЫ ЗДЕСЬ
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {reg.levelRange} · {reg.monsters.length} видов монстров
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {isLocked ? (
                      <span className="text-[10px] font-mono text-rose-400 font-bold">
                        Треб. ур. {reg.minLevel}
                      </span>
                    ) : (
                      <ChevronRight className={`w-5 h-5 ${isInspecting ? 'text-cyan-400' : 'text-slate-500'}`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caves & Dungeons Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-mono text-purple-400 uppercase tracking-wider">
            Древние пещеры и подземелья:
          </div>
          <span className="text-[11px] text-slate-400">
            {Object.keys(CAVES).length} локаций
          </span>
        </div>

        <div className="space-y-2">
          {Object.values(CAVES).map(cave => {
            const isSelected = selectedCaveId === cave.id;
            const canEnter = player.energy >= 15 && !(isInCombat && !isCombatEnded) && !(player.miningExpedition && !premium.active);
            return (
              <div
                key={cave.id}
                onClick={() => {
                  setSelectedCaveId(cave.id);
                  sound.playClick();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-purple-400 bg-purple-950/40 shadow-md shadow-purple-950'
                    : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                      {cave.icon}
                    </span>
                    <div>
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {cave.name}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {cave.roomsCount} комнат · Рекомендуемый ур. {cave.minLevel} · Вход 15 ⚡
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={!canEnter}
                    onClick={e => {
                      e.stopPropagation();
                      enterDungeon(cave.id, difficulty);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white active:scale-95 transition-transform"
                  >
                    Войти
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400">Все подземелья открыты с начала игры. Сложность врагов сохраняется. Для входа нужно 15 энергии и завершённый бой; во время шахтёрской экспедиции вход доступен только с Premium.</p>
        </div>
      </div>
    </div>
  );
};
