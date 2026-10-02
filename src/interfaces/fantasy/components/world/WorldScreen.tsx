import { huntingModeLockReason } from '../../../../utils/regionalProgress';
import { DUNGEON_DIFFICULTIES } from '../../../../utils/dungeonRewards';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { REGIONS, CAVES, ASSETS, REGION_MODIFIERS } from '../../data/gameData';
import { sound } from '../../../../utils/audio';
import { groupRegionsByLevel, levelEnvironment } from '../../utils/levelEnvironment';
import { BattleBackdrop, getBattleScene } from '../../../../components/combat/BattleBackdrop';
import { BestiaryPanel, FolioPage, OrnamentDivider, RpgButton, SectionTitle } from '../ui/BestiaryUI';
import { RpgIcon } from '../ui/RpgIcon';

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
                <RpgIcon kind="skill" size={40} className="text-[#d38d87]" />
              </div>
            ) : (
              <div className="p-4 rounded-full bg-cyan-950/60 border border-cyan-400">
                <RpgIcon kind="map" size={40} className="text-[#c7a365]" />
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

          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
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
      <FolioPage className="space-y-3 pt-3">
        <BestiaryPanel className="flex items-center justify-between rounded-xl p-3">
          <div>
            <div className="text-[11px] font-mono text-[#d5ba89] uppercase">Подземелье</div>
            <h2 className="font-cinzel text-sm font-bold text-slate-100">{activeDungeonRun.dungeonName}</h2>
            <div className="text-[11px] text-[#d5ba89]">Побед: {activeDungeonRun.kills || 0} · HP {activeDungeonRun.savedHp ?? combatStats.maxHp} · MP {activeDungeonRun.savedMp ?? combatStats.maxMp}</div>
          </div>
          <button
            onClick={() => { if (window.confirm('Покинуть подземелье? Прогресс этого захода будет потерян.')) exitDungeon(); }}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >
            Покинуть
          </button>
        </BestiaryPanel>

        {activeDungeonRun.lastEvent && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{activeDungeonRun.lastEvent}</p>}
        {activeDungeonRun.temporaryBlessing && <BestiaryPanel className="p-3 text-xs text-[#cdbb91]">{activeDungeonRun.temporaryBlessing.name}: +10% к физической и магической атаке и защите. Осталось побед: {activeDungeonRun.temporaryBlessing.remainingBattles}.</BestiaryPanel>}

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
            <h3 className="font-cinzel text-lg font-bold text-slate-100">
              Подземелье успешно зачищено!
            </h3>
            <p className="text-xs text-slate-300">
              Все комнаты пройдены, а босс повержен.
            </p>
            {activeDungeonRun.completionReward && <div className="rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs text-amber-200 space-y-1">
              <div className="font-bold">Награда за прохождение зачислена</div>
              <div>+{activeDungeonRun.completionReward.gold} золота · +{activeDungeonRun.completionReward.silver} серебра · +{activeDungeonRun.completionReward.exp} опыта</div>
              <div className="text-[11px] text-slate-400">Дополнительно к добыче с босса. Повторное открытие итогов не выдаёт награду повторно.</div>
            </div>}
            <button
              onClick={exitDungeon}
              className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all"
            >
              Вернуться в город
            </button>
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
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-[#d5ba89] text-[11px] font-mono">
                Комната {activeDungeonRun.currentRoomIndex + 1} из {activeDungeonRun.totalRooms}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <RpgIcon kind={currentRoom.type === 'boss' ? 'crown' : currentRoom.type === 'treasure' ? 'gold' : currentRoom.type === 'shrine' ? 'skill' : 'attack'} size={21} />
                <h3 className="font-cinzel text-base font-bold text-slate-100">
                  {currentRoom.title}
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {currentRoom.description}
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
                    <span>Сразиться с врагом</span>
                  </button>
                ) : currentRoom.type === 'treasure' ? (
                  <button
                    onClick={() => proceedDungeonRoom('open')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <RpgIcon kind="gold" size={17} />
                    <span>Открыть сундук · 25% пустой</span>
                  </button>
                ) : (
                  <button
                    onClick={() => proceedDungeonRoom('pray')}
                    className="ui-primary w-full py-3 rounded-xl font-cinzel font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <RpgIcon kind="skill" size={17} />
                    <span>Получить благословение · шанс 70%</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </FolioPage>
    );
  }

  const renderRegion = (reg: (typeof REGIONS)[number]) => {
    const isCurrent = player.currentRegionId === reg.id;
    const isInspecting = selectedRegionId === reg.id;
    const isLocked = player.level < reg.minLevel;
    const selectRegion = () => {
      setSelectedRegionId(reg.id);
      setSelectedModId(reg.id === currentRegion.id && reg.availableMods.includes(player.activeRegionModId || '')
        ? player.activeRegionModId!
        : reg.defaultModId);
      sound.playClick();
    };

    return (
      <div
        key={reg.id}
        onClick={selectRegion}
        className={`atlas-node bestiary-entry p-3 transition-all cursor-pointer ${
          isInspecting
            ? 'is-selected shadow-md '
            : isLocked
            ? 'border-[#383638] bg-[#101214] opacity-75'
            : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
        }`}
        role="button"
        tabIndex={0}
        aria-pressed={isInspecting}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectRegion(); } }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#514633] bg-[#111416]">
              <RpgIcon kind={isLocked ? 'bestiary' : 'map'} size={22} className={isLocked ? 'text-[#756d62]' : 'text-[#b99558]'} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-xs font-bold text-slate-100">
                  {reg.name}
                </span>
                {reg.isStarter && (
                  <span className="rounded border border-[#465b46] bg-[#1b281b] px-1 py-0.5 text-[11px] font-bold text-[#a8bc9b]">
                    СТАРТ
                  </span>
                )}
                {isCurrent && (
                  <span className="rounded border border-[#665940] bg-[#2c2519] px-1.5 py-0.5 text-[11px] font-bold text-[#d1ad67]">
                    ВЫ ЗДЕСЬ
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {reg.levelRange} · {reg.monsters.length} видов монстров
              </div>
            </div>
          </div>

          <div className="text-right">
            {isLocked ? (
              <span className="text-[11px] font-mono text-rose-400 font-bold">
                Треб. ур. {reg.minLevel}
              </span>
            ) : (
              <span aria-hidden="true" className={`text-2xl ${isInspecting ? 'text-[#d5ba89]' : 'text-slate-500'}`}>›</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 3. MAIN WORLD EXPLORATION VIEW
  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="relative isolate overflow-hidden rounded-xl">
        <div className="absolute inset-0 opacity-70"><BattleBackdrop scene={getBattleScene(inspectingRegion.id, currentRegion.id)} /></div>
        <div className="relative z-10 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#8b744c]/60 bg-[#111416]/85 text-[#c7a365]"><RpgIcon kind="map" size={25} /></span>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[.16em] text-[#d1ad67]">Атлас земель</div>
              <h1 className="folio-title text-lg font-bold">Карта Аэтельгарда</h1>
              <p className="mt-1 text-xs text-[#d8d1c4]">Выберите место для следующей охоты.</p>
            </div>
          </div>
          <OrnamentDivider className="my-3" />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <span className="text-[#d8d1c4]">Вы здесь: <strong className="text-[#e5ddd0]">{currentRegion.name}</strong></span>
            <span className="text-[#c5b393]">{levelEnvironment(player.level).name} · ур. {player.level}</span>
          </div>
          {errorMessage && <div role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/80 p-2.5 text-xs text-rose-200 animate-shake"><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-rose-400 font-bold">!</span><span>{errorMessage}</span></div>}
        </div>
      </BestiaryPanel>

      {/* Regions List with Starter Locations Badge */}
      <div className="space-y-2">
        <SectionTitle eyebrow="Отмечены на карте">Земли и рубежи</SectionTitle>

        <div className="space-y-2">
          {regionGroups.recommended.map(renderRegion)}
          {regionGroups.recommended.length === 0 && <p className="text-xs text-slate-400">Нет земель для вашего уровня.</p>}
        </div>
        {([
          { key: 'earlier', title: 'Локации низких уровней' },
          { key: 'future', title: 'Локации будущих уровней' },
        ] as const).map(group => regionGroups[group.key].length > 0 && (
          <details key={group.key} className="leather-panel p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs text-slate-400">
              {group.title} · {regionGroups[group.key].length}
              {regionGroups[group.key].some(region => region.id === currentRegion.id) && ' · Вы здесь'}
            </summary>
            <div className="mt-3 space-y-2">{regionGroups[group.key].map(renderRegion)}</div>
          </details>
        ))}
      </div>

      {/* Selected Region & Mode Control Card */}
      <BestiaryPanel className="space-y-3 p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#514633] bg-[#111416]"><RpgIcon kind="map" size={24} className="text-[#b99558]" /></span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-sm font-bold text-slate-100">
                  {inspectingRegion.name}
                </h3>
                {inspectingRegion.isStarter && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 text-[11px] font-mono font-bold">
                    СТАРТОВАЯ
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{inspectingRegion.levelRange} · {inspectingRegion.monsters.length} видов монстров</div>
            </div>
          </div>
        </div>
        <p title={inspectingRegion.description} className="line-clamp-2 text-xs text-[#aaa49a]">{inspectingRegion.description}</p>

        {/* Region Mode / Modifier Selector */}
        <div className="pt-1">
          <div className="mb-2 flex items-center justify-between text-xs font-mono text-[#d5ba89]">
            <span>Режим охоты:</span>
            <span className="text-xs text-amber-300">Расход: {activeMod.energyCost} энергии</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(inspectingRegion.availableMods || ['mod_standard']).map(mId => {
              const mod = REGION_MODIFIERS[mId];
              if (!mod) return null;
              const isSelected = selectedModId === mod.id;
              const modeLock = huntingModeLockReason(player, inspectingRegion, mod.id);

              return (
                <button
                  key={mod.id}
                  disabled={player.level<inspectingRegion.minLevel || Boolean(modeLock)}
                  onClick={() => {
                    setSelectedModId(mod.id);
                    if (inspectingRegion.id === currentRegion.id) setActiveRegionMod(mod.id);
                    sound.playClick();
                  }}
                  className={`min-h-[74px] rounded-xl border p-2 text-left transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'border-[#9d8459] bg-[#302c24]'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <RpgIcon kind={mod.id === 'mod_standard' ? 'attack' : 'skill'} size={17} className="shrink-0 text-[#b99558]" />
                    <span className="truncate font-cinzel text-xs font-bold text-slate-200">
                      {mod.name}
                    </span>
                  </div>
                  {modeLock && <p className="mb-1 text-xs text-amber-300">Закрыто: {modeLock}</p>}
                  <div className="text-[11px] leading-snug text-slate-400">
                    HP ×{mod.hpMultiplier||1} · Урон ×{mod.damageMultiplier}<br/>Защита ×{mod.defenseMultiplier||1} · Дроп: x{mod.rareDropMultiplier}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Mode Description Box */}
          <p title={activeMod.description} className="mt-2 line-clamp-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-300"><span className="font-bold text-amber-300">{activeMod.name}: </span>{activeMod.description}</p>
        </div>

        {/* Travel / Action Button */}
        <div className="pt-2">
          {player.currentRegionId === inspectingRegion.id ? (
            <RpgButton
              onClick={() => {
                if (onEnterCombatTab) onEnterCombatTab();
              }}
              variant="primary"
              icon="attack"
              className="w-full"
            >
              Перейти к охоте
            </RpgButton>
          ) : (
            <>
              <RpgButton
                onClick={() => handleStartTravel(inspectingRegion.id)}
                disabled={player.level < inspectingRegion.minLevel}
                variant="primary"
                icon="map"
                className="w-full disabled:opacity-50"
              >
                Отправиться в путь · 3 сек · {activeMod.energyCost} энергии
              </RpgButton>
              {player.level < inspectingRegion.minLevel && (
                <p className="mt-2 text-center text-xs text-rose-300">Локация откроется на {inspectingRegion.minLevel}-м уровне. Сейчас её можно только посмотреть.</p>
              )}
            </>
          )}
        </div>
      </BestiaryPanel>

      {/* Caves & Dungeons Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle eyebrow="Испытания">Пещеры и подземелья</SectionTitle>
          <span className="text-[11px] text-slate-400">
            {Object.keys(CAVES).length} локаций
          </span>
        </div>

        <label className="block text-xs text-[#c5b393]">Сложность похода
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)} className="mt-1 min-h-11 w-full rounded-lg border border-[#514633] bg-slate-950 p-2 text-sm text-[#d8d1c4]">
            <option value="normal">Обычная · награда ×1</option><option value="hard">Сложная · награда ×1,5</option><option value="nightmare">Кошмар · награда ×2</option><option value="hell">Ад · награда ×3</option>
          </select>
          <span className="mt-1 block text-slate-400">HP врагов ×{DUNGEON_DIFFICULTIES[difficulty].hp} · урон ×{DUNGEON_DIFFICULTIES[difficulty].damage} · защита ×{DUNGEON_DIFFICULTIES[difficulty].defense}. Множитель награды относится к завершению похода.</span>
        </label>

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
                className={`bestiary-entry p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-purple-400 bg-purple-950/40 shadow-md '
                    : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-800 bg-slate-900"><RpgIcon kind="bestiary" size={22} className="text-[#b99558]" /></span>
                    <div>
                      <span className="font-cinzel text-xs font-bold text-slate-100">
                        {cave.name}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {cave.roomsCount} комнат · уровень {cave.minLevel} · вход 15 энергии
                      </div>
                    </div>
                  </div>

                  <RpgButton
                    disabled={!canEnter}
                    onClick={e => {
                      e.stopPropagation();
                      enterDungeon(cave.id, difficulty);
                    }}
                    variant="secondary"
                    className="min-h-11 px-3 disabled:opacity-40"
                  >
                    Войти
                  </RpgButton>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400">Все подземелья открыты с начала игры. Вход: 15 энергии и завершённый бой.</p>
        </div>
      </div>
    </FolioPage>
  );
};
