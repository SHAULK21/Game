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
import { groupRegionsByLevel } from '../../utils/levelEnvironment';
import { LevelEnvironment } from '../ui/LevelEnvironment';

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
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    const suitable = groupRegionsByLevel(REGIONS, player?.level || 1).recommended;
    return suitable.find(region => region.id === player?.currentRegionId)?.id || suitable[0]?.id || 'reg_plains';
  });
  const [selectedModId, setSelectedModId] = useState<string>(() => {
    const selected = REGIONS.find(region => region.id === selectedRegionId)!;
    return selected.id === player?.currentRegionId && selected.availableMods.includes(player.activeRegionModId || '')
      ? player.activeRegionModId! : selected.defaultModId;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!player) return null;

  const currentRegion = REGIONS.find(r => r.id === player.currentRegionId) || REGIONS[0];
  const inspectingRegion = REGIONS.find(r => r.id === selectedRegionId) || currentRegion;
  const regionGroups = groupRegionsByLevel(REGIONS, player.level);
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
            <span className="text-[#d5ba89] font-bold">{travelState.progress}%</span>
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
            <div className="text-[10px] font-mono text-[#d5ba89] uppercase">Подземелье</div>
            <h2 className="font-cinzel text-sm font-bold text-slate-100">{activeDungeonRun.dungeonName}</h2>
            <div className="text-[10px] text-[#d5ba89]">Побед: {activeDungeonRun.kills || 0} · HP {activeDungeonRun.savedHp ?? combatStats.maxHp} · MP {activeDungeonRun.savedMp ?? combatStats.maxMp}</div>
          </div>
          <button
            onClick={() => { if (window.confirm('Покинуть подземелье? Прогресс этого захода будет потерян.')) exitDungeon(); }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >
            Покинуть
          </button>
        </div>

        {activeDungeonRun.lastEvent && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{activeDungeonRun.lastEvent}</p>}
        {activeDungeonRun.temporaryBlessing && <p className="rounded-xl border border-slate-700 p-3 text-xs text-cyan-200">✨ {activeDungeonRun.temporaryBlessing.name}: +10% к физической и магической атаке и защите. Осталось побед: {activeDungeonRun.temporaryBlessing.remainingBattles}. Действует только в этом походе.</p>}

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
            <h3 className="font-cinzel text-lg font-bold text-slate-100">
              Подземелье успешно зачищено!
            </h3>
            <p className="text-xs text-slate-300">
              Все комнаты пройдены, а босс повержен.
            </p>
            {activeDungeonRun.completionReward && <div className="rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs text-amber-200 space-y-1">
              <div className="font-bold">Награда за прохождение зачислена</div>
              <div>+{activeDungeonRun.completionReward.gold} золота · +{activeDungeonRun.completionReward.silver} серебра · +{activeDungeonRun.completionReward.exp} опыта</div>
              <div className="text-[10px] text-slate-400">Дополнительно к добыче с босса. Повторное открытие итогов не выдаёт награду повторно.</div>
            </div>}
            <button
              onClick={exitDungeon}
              className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all"
            >
              Вернуться в город
            </button>
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
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-[#d5ba89] text-[10px] font-mono">
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
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Skull className="w-4 h-4" />
                    <span>Сразиться с врагом</span>
                  </button>
                ) : currentRoom.type === 'treasure' ? (
                  <button
                    onClick={() => proceedDungeonRoom('open')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>Открыть сундук · 25% пустой</span>
                  </button>
                ) : (
                  <button
                    onClick={() => proceedDungeonRoom('pray')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Получить благословение · шанс 70%</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderRegion = (reg: (typeof REGIONS)[number]) => {
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
            ? 'border-cyan-400 bg-cyan-950/40 shadow-md '
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
              <ChevronRight className={`w-5 h-5 ${isInspecting ? 'text-[#d5ba89]' : 'text-slate-500'}`} />
            )}
          </div>
        </div>
      </div>
    );
  };

  // 3. MAIN WORLD EXPLORATION VIEW
  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header Banner */}
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-400/40 text-[#d5ba89]">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Карта Аэтельгарда
            </h2>
            <p className="text-xs text-slate-300">
              Локации вашего уровня — на первом плане. Выберите место для охоты.
            </p>
          </div>
        </div>

        <LevelEnvironment level={player.level} />
        <p className="mt-2 text-[11px] text-slate-400">Вы находитесь: {currentRegion.name}</p>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Regions List with Starter Locations Badge */}
      <div className="space-y-2">
        <div className="text-xs font-mono text-[#d5ba89] uppercase tracking-wider px-1">
          Подходят вашему уровню:
        </div>

        <div className="space-y-2">
          {regionGroups.recommended.map(renderRegion)}
          {regionGroups.recommended.length === 0 && <p className="text-xs text-slate-400">Выберите локацию в соседних этапах.</p>}
        </div>
        {([
          { key: 'earlier', title: 'Локации низких уровней' },
          { key: 'future', title: 'Локации будущих уровней' },
        ] as const).map(group => regionGroups[group.key].length > 0 && (
          <details key={group.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <summary className="cursor-pointer text-xs text-slate-400">
              {group.title} · {regionGroups[group.key].length}
              {regionGroups[group.key].some(region => region.id === currentRegion.id) && ' · Вы здесь'}
            </summary>
            <div className="mt-3 space-y-2">{regionGroups[group.key].map(renderRegion)}</div>
          </details>
        ))}
      </div>

      {/* Selected Region & Mode Control Card */}
      <div className="rounded-2xl border border-indigo-500/30 bg-[#090d18] p-4 space-y-3">
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
          <div className="flex items-center justify-between text-xs font-mono text-[#d5ba89] mb-2">
            <span>Режим охоты:</span>
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
                  disabled={player.level<inspectingRegion.minLevel}
                  onClick={() => {
                    setSelectedModId(mod.id);
                    if (inspectingRegion.id === currentRegion.id) setActiveRegionMod(mod.id);
                    sound.playClick();
                  }}
                  className={`p-2 rounded-xl border text-left transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                    isSelected 
                      ? 'border-[#9d8459] bg-[#302c24]'
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
                    HP ×{mod.hpMultiplier||1} · Урон ×{mod.damageMultiplier}<br/>Защита ×{mod.defenseMultiplier||1} · Дроп: x{mod.rareDropMultiplier}
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
              className="ui-primary w-full py-2.5 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>⚔️ Перейти к охоте на монстров</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStartTravel(inspectingRegion.id)}
                disabled={player.level < inspectingRegion.minLevel}
                className="ui-primary w-full py-2.5 rounded-xl disabled:opacity-50 font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
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
                    ? 'border-purple-400 bg-purple-950/40 shadow-md '
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
