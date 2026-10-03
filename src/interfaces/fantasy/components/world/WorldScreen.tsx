import { t as localize, useLocale } from '../../../../i18n/locale';
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
  useLocale();
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
    return REGIONS.find(region => region.id === player?.currentRegionId)?.id || suitable[0]?.id || 'reg_plains';
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
      <div className="fantasy-travel-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
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
        className={`atlas-node codex-paper bestiary-entry p-3 transition-all cursor-pointer ${
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
                  {localize(reg.name)}
                </span>
                {reg.isStarter && (
                  <span className="rounded border border-[#465b46] bg-[#1b281b] px-1 py-0.5 text-[11px] font-bold text-[#a8bc9b]">{localize("СТАРТ")}</span>
                )}
                {isCurrent && (
                  <span className="rounded border border-[#665940] bg-[#2c2519] px-1.5 py-0.5 text-[11px] font-bold text-[#d1ad67]">{localize("ВЫ ЗДЕСЬ")}</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {localize(reg.levelRange)} · {localize(reg.monsters.length)}{localize(" видов монстров")}</div>
            </div>
          </div>

          <div className="text-right">
            {isLocked ? (
              <span className="text-[11px] font-mono text-rose-400 font-bold">{localize("Треб. ур. ")}{localize(reg.minLevel)}
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
    <FolioPage className="world-codex space-y-3 pt-3">
      <BestiaryPanel className="relative isolate overflow-hidden rounded-xl">
        <div className="absolute inset-0 opacity-70"><BattleBackdrop scene={getBattleScene(inspectingRegion.id, currentRegion.id)} /></div>
        <div className="relative z-10 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#8b744c]/60 bg-[#111416]/85 text-[#c7a365]"><RpgIcon kind="map" size={25} /></span>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[.16em] text-[#d1ad67]">{localize("Атлас земель")}</div>
              <h1 className="folio-title text-lg font-bold">{localize("Карта Аэтельгарда")}</h1>
              <p className="mt-1 text-xs text-[#d8d1c4]">{localize("Выберите место для следующей охоты.")}</p>
            </div>
          </div>
          <OrnamentDivider className="my-3" />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <span className="text-[#d8d1c4]">{localize("Вы здесь: ")}<strong className="text-[#e5ddd0]">{localize(currentRegion.name)}</strong></span>
            <span className="text-[#c5b393]">{localize(levelEnvironment(player.level).name)}{localize(" · ур. ")}{localize(player.level)}</span>
          </div>
          {errorMessage && <div role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/80 p-2.5 text-xs text-rose-200 animate-shake"><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-rose-400 font-bold">!</span><span>{localize(errorMessage)}</span></div>}
        </div>
      </BestiaryPanel>

      {/* Regions List with Starter Locations Badge */}
      <div className="space-y-2">
        <SectionTitle eyebrow="Отмечены на карте">{localize("Земли и рубежи")}</SectionTitle>

        <div className="space-y-2">
          {localize(regionGroups.recommended.map(renderRegion))}
          {regionGroups.recommended.length === 0 && <p className="text-xs text-slate-400">{localize("Нет земель для вашего уровня.")}</p>}
        </div>
        {([
          { key: 'earlier', title: 'Локации низких уровней' },
          { key: 'future', title: 'Локации будущих уровней' },
        ] as const).map(group => regionGroups[group.key].length > 0 && (
          <details key={group.key} className="leather-panel p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs text-slate-400">
              {localize(group.title)} · {localize(regionGroups[group.key].length)}
              {localize(regionGroups[group.key].some(region => region.id === currentRegion.id) && ' · Вы здесь')}
            </summary>
            <div className="mt-3 space-y-2">{localize(regionGroups[group.key].map(renderRegion))}</div>
          </details>
        ))}
      </div>

      {/* Selected Region & Mode Control Card */}
      <BestiaryPanel className="region-dispatch quest-book space-y-3 p-3">
        <div className="region-dispatch-heading flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="region-map-seal"><RpgIcon kind="map" size={24} /></span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="region-dispatch-name">
                  {localize(inspectingRegion.name)}
                </h3>
                {inspectingRegion.isStarter && (
                  <span className="region-starter-stamp">{localize("СТАРТОВАЯ")}</span>
                )}
              </div>
              <div className="region-dispatch-meta">{localize(inspectingRegion.levelRange)} · {localize(inspectingRegion.monsters.length)}{localize(" видов монстров")}</div>
            </div>
          </div>
        </div>
        <p title={localize(inspectingRegion.description)} className="region-dispatch-description">{localize(inspectingRegion.description)}</p>

        {/* Region Mode / Modifier Selector */}
        <div className="pt-1">
          <div className="hunting-mode-heading">
            <span>{localize("Режим охоты:")}</span>
            <span>{localize("Расход: ")}{localize(activeMod.energyCost)}{localize(" энергии")}</span>
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
                  aria-pressed={isSelected}
                  data-hunting-mode={mod.id}
                  className="hunting-mode-entry"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <RpgIcon kind={mod.id === 'mod_standard' ? 'attack' : 'skill'} size={17} className="shrink-0 text-[#b99558]" />
                    <span className="hunting-mode-name">
                      {localize(mod.name)}
                    </span>
                  </div>
                  {modeLock && <p className="hunting-mode-lock">{localize("Закрыто: ")}{localize(modeLock)}</p>}
                  <div className="hunting-mode-values">
                    HP ×{localize(mod.hpMultiplier||1)}{localize(" · Урон ×")}{localize(mod.damageMultiplier)}<br/>{localize("Защита ×")}{localize(mod.defenseMultiplier||1)}{localize(" · Дроп: x")}{localize(mod.rareDropMultiplier)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Mode Description Box */}
          <p title={localize(activeMod.description)} className="hunting-mode-description"><span className="font-bold">{localize(activeMod.name)}: </span>{localize(activeMod.description)}</p>
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
            >{localize("Перейти к охоте")}</RpgButton>
          ) : (
            <>
              <RpgButton
                onClick={() => handleStartTravel(inspectingRegion.id)}
                disabled={player.level < inspectingRegion.minLevel}
                variant="primary"
                icon="map"
                className="w-full disabled:opacity-50"
              >{localize("Отправиться в путь · 3 сек · ")}{localize(activeMod.energyCost)}{localize(" энергии")}</RpgButton>
              {player.level < inspectingRegion.minLevel && (
                <p className="mt-2 text-center text-xs text-rose-300">{localize("Локация откроется на ")}{localize(inspectingRegion.minLevel)}{localize("-м уровне. Сейчас её можно только посмотреть.")}</p>
              )}
            </>
          )}
        </div>
      </BestiaryPanel>

      {/* Caves & Dungeons Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <SectionTitle eyebrow="Испытания">{localize("Пещеры и подземелья")}</SectionTitle>
          <span className="text-[11px] text-slate-400">
            {localize(Object.keys(CAVES).length)}{localize(" локаций")}</span>
        </div>

        <label className="block text-xs text-[#c5b393]">{localize("Сложность похода")}<select value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)} className="mt-1 min-h-11 w-full rounded-lg border border-[#514633] bg-slate-950 p-2 text-sm text-[#d8d1c4]">
            <option value="normal">{localize("Обычная · награда ×1")}</option><option value="hard">{localize("Сложная · награда ×1,5")}</option><option value="nightmare">{localize("Кошмар · награда ×2")}</option><option value="hell">{localize("Ад · награда ×3")}</option>
          </select>
          <span className="mt-1 block text-slate-400">{localize("HP врагов ×")}{localize(DUNGEON_DIFFICULTIES[difficulty].hp)}{localize(" · урон ×")}{localize(DUNGEON_DIFFICULTIES[difficulty].damage)}{localize(" · защита ×")}{localize(DUNGEON_DIFFICULTIES[difficulty].defense)}{localize(". Множитель награды относится к завершению похода.")}</span>
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
                        {localize(cave.name)}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {localize(cave.roomsCount)}{localize(" комнат · уровень ")}{localize(cave.minLevel)}{localize(" · вход 15 энергии")}</div>
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
                  >{localize("Войти")}</RpgButton>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400">{localize("Все подземелья открыты с начала игры. Вход: 15 энергии и завершённый бой.")}</p>
        </div>
      </div>
    </FolioPage>
  );
};
