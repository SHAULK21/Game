import { t as localize, useLocale } from '../../../../i18n/locale';
import { huntLockReason, regionProgress, huntingModeLockReason } from '../../../../utils/regionalProgress';
import { predictedMonsterSkill } from '../../../../utils/autoBattle';
import { talentManaCost } from '../../../../data/talents';
import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../../../context/GameContext';
import { MONSTERS, REGIONS, CAVES, REGION_MODIFIERS, CLASSES, ASSETS, getRegionMonster } from '../../data/gameData';
import { getBattleScene } from '../../../../components/combat/BattleBackdrop';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';
import { skillTier } from '../../../../data/classEvolution';
import { getEnergyElixirPrice } from '../../../../utils/dungeonRewards';
import { HuntDashboard } from './HuntDashboard';
import { CombatArena } from './CombatArena';
import { RpgButton } from '../ui/BestiaryUI';

export const getPredictedMonsterSkill = predictedMonsterSkill;

export const CombatScreen: React.FC<{ onContinueDungeon?: () => void; onReturnToArena?: () => void }> = ({ onContinueDungeon, onReturnToArena }) => {
  useLocale();
  const {
    player,
    activeMonster,
    battleLog,
    combatRound,
    lastCombatReward,
    isInCombat,
    isCombatEnded,
    combatOutcome,
    combatPlayerHp,
    combatPlayerMp,
    turnPhase,
    playerEffects,
    monsterEffects,
    monsterIntent,
    comboReady,
    autoBattle,
    combatStats,
    combatChain,
    activeDungeonRun,
    premium,
    startBattleWithMonster,
    startNextCombatBattle,
    performPlayerAction,
    toggleAutoBattle,
    updateAutoBattleSettings,
    exitCombat,
    meditateOrRefillEnergy,
    preparePremiumInvoice,
    purchasePremium,
    leaveMiningExpedition
  } = useGame();

  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isPotionsOpen, setIsPotionsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string>('m_wolf');
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [premiumPromptOpen, setPremiumPromptOpen] = useState(false);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumFeedback, setPremiumFeedback] = useState<string | null>(null);
  const [preparedPremiumInvoice, setPreparedPremiumInvoice] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll combat log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [battleLog]);

  useEffect(() => {
    if (!premiumPromptOpen || premium.active || preparedPremiumInvoice) return;
    preparePremiumInvoice().then(link => {
      if (link) setPreparedPremiumInvoice(link);
    }).catch(() => undefined);
  }, [premiumPromptOpen, premium.active, preparedPremiumInvoice, preparePremiumInvoice]);

  if (!player) return null;

  const currentRegion = REGIONS.find(r => r.id === player.currentRegionId) || REGIONS[0];
  const regionMonsters = currentRegion.monsters.map(id => MONSTERS[id]).filter(Boolean).map(mon => getRegionMonster(mon, currentRegion));
  const selectedMonster = regionMonsters.find(mon => mon.id === selectedMonsterId) || regionMonsters[0];
  const activeMod = REGION_MODIFIERS[player.activeRegionModId || currentRegion.defaultModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;
  const combatEnergyCost = 2;
  const progress = regionProgress(player, currentRegion);
  const selectedLock = selectedMonster ? huntLockReason(player, selectedMonster, currentRegion) || huntingModeLockReason(player, currentRegion, activeMod.id) : null;
  const nextMonsterSkill = activeMonster ? getPredictedMonsterSkill(activeMonster) : null;

  const combatPotions = player.inventory.filter(i => i.type === 'potion');
  const potionCount = combatPotions.reduce((sum, item) => sum + (item.stackCount || 1), 0);

  const handleStartBattle = (mon: typeof MONSTERS[string]) => {
    setEnergyError(null);
    if (player.miningExpedition && !premium.active) {
      setEnergyError('Персонаж сейчас в шахте. Сначала нажмите «Уйти с шахты».');
      return;
    }
    const lock = huntLockReason(player, mon, currentRegion) || huntingModeLockReason(player, currentRegion, activeMod.id);
    if (lock) {setEnergyError(lock);return;}
    const success = startBattleWithMonster(mon);
    if (!success) {
      setEnergyError(`Недостаточно энергии! Для боя нужно ${combatEnergyCost}, сейчас у вас ${player.energy ?? 0}.`);
      setTimeout(() => setEnergyError(null), 5000);
    }
  };

  const handleAutoBattleClick = () => {
    if (!premium.active) {
      setPremiumFeedback(null);
      setPremiumPromptOpen(true);
      return;
    }
    toggleAutoBattle();
  };

  const premiumModal = premiumPromptOpen ? (
    <div className="bottom-sheet-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-label="Aethelgard Premium" className="dialog-frame w-full max-w-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2"><RpgIcon kind="crown" size={23} className="text-[#c7a365]" /><div><h2 className="section-title">Aethelgard Premium</h2><p className="text-[11px] text-[#918c82]">{localize("Автобой доступен с Premium")}</p></div></div>
          <button onClick={() => setPremiumPromptOpen(false)} aria-label={localize("Закрыть")} className="rpg-icon-button"><span className="text-xl">×</span></button>
        </div>
        <div className="mt-4 space-y-2 text-xs text-[#c5c0b6]">
          <div className="flex items-center gap-2"><RpgIcon kind="attack" size={17} className="text-[#bd8d6e]" />{localize("Автобой и автопродолжение серии")}</div>
          <div className="flex items-center gap-2"><RpgIcon kind="mine" size={17} className="text-[#c7a365]" />{localize("Офлайн-добыча")}</div>
          <div className="flex items-center gap-2"><RpgIcon kind="settings" size={17} className="text-[#aaa49a]" />{localize("Расширенные настройки автобоя")}</div>
          <div className="flex items-center gap-2"><RpgIcon kind="crown" size={17} className="text-[#c7a365]" />{localize("Статус VIP")}</div>
        </div>
        <div className="mt-4 rounded-lg border border-[#5a492b] bg-[#201b12] p-3 text-center">
          <div className="text-xl font-bold text-[#e0c486]">150 Telegram Stars</div>
          <div className="text-[11px] text-[#918c82]">{localize("30 дней")}</div>
        </div>
        <RpgButton variant="primary" disabled={premiumBusy} onClick={async () => {
          setPremiumBusy(true);
          setPremiumFeedback(null);
          const result = await purchasePremium(preparedPremiumInvoice);
          setPremiumFeedback(result.message);
          setPremiumBusy(false);
          if (result.success) setTimeout(() => setPremiumPromptOpen(false), 900);
        }} className="mt-4 w-full text-sm">{localize(premiumBusy ? 'Открываю оплату…' : 'Купить Premium · 150 Stars')}</RpgButton>
        {premiumFeedback && <div className="mt-2 text-center text-[11px] text-[#c5c0b6]">{localize(premiumFeedback)}</div>}
      </section>
    </div>
  ) : null;

  // OUT OF COMBAT: Hunting Dashboard
  if (!isInCombat || !activeMonster) {
    return (
      <>
        {localize(premiumModal)}
        <HuntDashboard
          player={player}
          currentRegion={currentRegion}
          regionMonsters={regionMonsters}
          selectedMonster={selectedMonster}
          activeMod={activeMod}
          selectedLock={selectedLock}
          progress={progress}
          energyError={energyError}
          combatEnergyCost={combatEnergyCost}
          autoBattle={autoBattle}
          isSettingsOpen={isSettingsOpen}
          premiumActive={premium.active}
          elixirPrice={getEnergyElixirPrice(premium.active)}
          getMonsterLock={monster => huntLockReason(player, monster, currentRegion) || huntingModeLockReason(player, currentRegion, activeMod.id)}
          onSelectMonster={setSelectedMonsterId}
          onStartHunt={() => { if (selectedMonster) handleStartBattle(selectedMonster); }}
          onToggleSettings={() => setIsSettingsOpen(open => !open)}
          onUpdateAutoBattle={updateAutoBattleSettings}
          onMeditate={() => meditateOrRefillEnergy('meditate')}
          onBuyElixir={() => meditateOrRefillEnergy('silver')}
          onLeaveMine={() => {
            const result = leaveMiningExpedition();
            setEnergyError(result.message);
          }}
        />
      </>
    );
  }
  // ACTIVE COMBAT SCREEN
  const playerClass = CLASSES[player.classId] || CLASSES['warrior'];
  const playerHeroImg = playerClass?.image || ASSETS.heroHunter;
  const battleDungeon = activeMonster.regionId !== 'arena' && activeDungeonRun ? CAVES[activeDungeonRun.dungeonId] : undefined;
  const battleRegion = REGIONS.find(region => region.id === activeMonster.regionId) || currentRegion;
  const battleLocationName = activeMonster.regionId === 'arena' ? 'Колизей Чемпионов' : battleDungeon?.name || battleRegion.name;
  const battleScene = getBattleScene(activeMonster.regionId, currentRegion.id, battleDungeon?.id);

  return (
    <div className="folio-page space-y-3 pt-3">
      {localize(premiumModal)}
      <CombatArena
        player={player}
        monster={activeMonster}
        heroImage={playerHeroImg}
        heroClassName={playerClass.name}
        locationName={battleLocationName}
        modifierName={activeMod.name}
        scene={battleScene}
        dungeonId={battleDungeon?.id}
        round={combatRound}
        turnPhase={turnPhase}
        playerHp={combatPlayerHp}
        playerMp={combatPlayerMp}
        maxHp={combatStats.maxHp}
        maxMp={combatStats.maxMp}
        playerEffects={playerEffects}
        monsterEffects={monsterEffects}
        latestEvent={battleLog.at(-1)}
      />
      {/* Combat status and actions */}
      <div className="combat-command-center space-y-2">
        <div className={`combat-turn-status flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
          turnPhase === 'player'
            ? 'bg-[#211f1a] border-[#69583a] text-[#d5ba89]'
            : turnPhase === 'monster'
            ? 'bg-[#2a191a] border-[#6a3b3b] text-[#e3b9b2]'
            : 'bg-[#15191c] border-[#35383a] text-[#c2bdb3]'
        }`}>
          <div className="flex items-center gap-2">
            {turnPhase === 'player' ? (
              <>
                <RpgIcon kind="attack" size={16} className="text-[#c7a365]" />
                <span className="font-semibold">{localize("Ваш ход")}</span>
                <span className="hidden text-[11px] text-[#aaa49a] sm:inline">{localize("Выберите действие")}</span>
              </>
            ) : turnPhase === 'monster' ? (
              <>
                <RpgIcon kind="bestiary" size={16} className="text-[#d38d87]" />
                <span className="font-bold">{localize("Ход противника")}</span>
                <span className="hidden max-w-36 truncate text-[11px] text-[#c1a8a3] sm:inline">{localize(activeMonster.name)}{localize(" атакует")}</span>
              </>
            ) : (
              <span className="font-bold">{localize("Бой завершён")}</span>
            )}
          </div>

          {/* Auto-Battle Toggle */}
          <button
            onClick={handleAutoBattleClick}
            title={localize(premium.active ? 'Автобой' : 'Доступно с Aethelgard Premium')}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition-colors ${
              autoBattle.enabled
                ? 'border-[#b99558] bg-[#b99558] text-[#14120f]'
                : 'border-[#414345] bg-[#202428] text-[#c8c2b8] hover:text-white'
            }`}
          >
            <RpgIcon kind={autoBattle.enabled ? 'skill' : 'settings'} size={15} />
            <span>{localize(premium.active ? (autoBattle.enabled ? 'Авто: ВКЛ' : 'Авто: ВЫКЛ') : 'Автобой · PREMIUM')}</span>
          </button>
        </div>

        {turnPhase === 'player' && activeMonster && !isCombatEnded && (
          <details className="bestiary-panel overflow-hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs">
              <RpgIcon kind={nextMonsterSkill ? 'skill' : 'attack'} size={17} className="text-[#c7a365]" />
              <span className="min-w-0 flex-1"><span className="mr-1 text-[11px] text-[#918c82]">{localize("Враг готовит:")}</span><strong className="text-[#d8d1c4]">{localize(nextMonsterSkill ? nextMonsterSkill.name : 'Обычная атака')}</strong></span>
              {nextMonsterSkill && <span className="shrink-0 font-mono text-[11px] text-[#d28f89]">×{localize(Math.round(nextMonsterSkill.damageMultiplier * 100))}%</span>}
            </summary>
            <p className="border-t border-[#343638] px-3 py-2 text-[11px] text-[#aaa49a]">{localize(nextMonsterSkill?.description || 'Противник нанесёт обычный физический удар.')}</p>
          </details>
        )}

        {monsterIntent && turnPhase === 'monster' && (
          <div className="rounded-xl border border-amber-500/60 bg-amber-950/40 p-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <RpgIcon kind="skill" size={17} />
              <span>{localize(activeMonster.name)}{localize(" применит «")}{localize(monsterIntent.name)}»</span>
            </div>
            <div className="text-[11px] text-amber-100/70 mt-1">{localize(monsterIntent.description)}</div>
          </div>
        )}

        {combatChain && <div className="bestiary-panel flex min-h-8 items-center justify-between gap-3 px-3 py-1 text-[11px]">
          <span className="flex items-center gap-1.5 font-bold text-[#d1ad67]"><RpgIcon kind="hunt" size={14} />{localize("Боевая серия")}</span>
          <span className="font-mono text-[#c5c0b6]">{localize(combatChain.defeated)}/{localize(combatChain.total)}{localize(" · осталось ")}{localize(combatChain.remaining)}</span>
        </div>}

        {/* COMBAT ACTIONS OR COMBAT RESULT */}
        {isCombatEnded ? (
          <div className="bestiary-panel space-y-3 p-3.5 text-center">
            <div className="folio-title flex items-center justify-center gap-2 text-lg font-bold">
              {combatOutcome === 'victory' && (
                <>
                  <RpgIcon kind="gold" size={19} className="text-[#c7a365]" />
                  <span>{localize(activeMonster?.regionId === 'ascension' ? 'ИСПЫТАНИЕ ПРОЙДЕНО!' : combatChain && combatChain.remaining > 0 ? 'ВРАГ ПОВЕРЖЕН — СЕРИЯ ПРОДОЛЖАЕТСЯ' : 'ПОБЕДА! СЕРИЯ ЗАВЕРШЕНА')}</span>
                </>
              )}
              {localize(combatOutcome === 'defeat' && 'ПОРАЖЕНИЕ В БОЮ')}
              {localize(combatOutcome === 'flee' && 'ВЫ ВЫРВАЛИСЬ ИЗ БОЯ')}
            </div>

            {combatOutcome === 'defeat' && activeMonster?.regionId === 'arena' && lastCombatReward?.arenaRatingGain !== undefined && (
              <div className="text-xs font-bold text-rose-300">{localize("Рейтинг арены: −")}{localize(Math.abs(lastCombatReward.arenaRatingGain))} PTS</div>
            )}
            {combatOutcome === 'victory' && activeMonster?.regionId === 'ascension' && (
              <p className="text-xs text-emerald-300">{localize("Победа сохранена. Вернитесь на арену, чтобы продолжить вознесение.")}{localize(Boolean(lastCombatReward?.silver) && ` Получено ${lastCombatReward?.silver} серебра.`)}</p>
            )}
            {combatOutcome === 'victory' && activeMonster?.regionId !== 'ascension' && (!combatChain || combatChain.remaining === 0) && lastCombatReward && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-left">
                <div className="text-[11px] font-bold text-emerald-300 mb-2">{localize(combatChain ? 'Награда за серию' : 'Получено за бой')}</div>
                {Boolean(lastCombatReward.arenaRatingGain) && <div className="mb-2 text-xs font-bold text-yellow-300">{localize("Рейтинг арены: +")}{localize(lastCombatReward.arenaRatingGain)} PTS</div>}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-amber-300 font-bold">+{localize(lastCombatReward.gold)}</div>
                    <div className="text-slate-500">{localize("золото")}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-slate-200 font-bold">+{localize(lastCombatReward.silver)}</div>
                    <div className="text-slate-500">{localize("серебро")}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-cyan-300 font-bold">+{localize(lastCombatReward.exp)}</div>
                    <div className="text-slate-500">EXP</div>
                  </div>
                </div>
                {lastCombatReward.items.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {lastCombatReward.items.map((item, index) => (
                      <div key={item.id + index} className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-2 flex items-center gap-2">
                        <ItemArtwork item={item} size={32} />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-100 leading-tight break-words">{localize(item.name)}</div>
                          <div className="text-[11px] text-slate-500">×{localize(item.stackCount || 1)} · {localize(item.rarity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-500">{localize("Предметов не выпало.")}</div>
                )}
              </div>
            )}

            {combatChain && (
              <div className="rounded-xl bg-black/20 border border-slate-800 p-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{localize("Серия противников")}</span>
                  <span className="text-cyan-300 font-bold">{localize(combatChain.defeated)}/{localize(combatChain.total)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${Math.min(100, (combatChain.defeated / combatChain.total) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {localize(combatChain.remaining > 0
                    ? `Осталось ${combatChain.remaining}. Награда за каждого врага сохраняется.`
                    : 'Все враги серии повержены. Для новой серии потребуется энергия.')}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {activeMonster?.regionId === 'ascension' ? (
                <button
                  onClick={() => { exitCombat(); onReturnToArena?.(); }}
                  className="rpg-button rpg-button-primary flex-1 text-xs"
                >{localize("Вернуться на арену")}</button>
              ) : activeDungeonRun ? (
                <button
                  onClick={() => { exitCombat(); onContinueDungeon?.(); }}
                  className="rpg-button rpg-button-primary flex-1 text-xs"
                >
                  {localize(activeDungeonRun.completed ? 'Итоги подземелья' : combatOutcome === 'victory' ? 'Продолжить подземелье' : 'Вернуться в подземелье')}
                </button>
              ) : combatOutcome === 'victory' && combatChain && combatChain.remaining > 0 ? (
                <button
                  onClick={startNextCombatBattle}
                  className="rpg-button rpg-button-primary flex-1 text-xs"
                >{localize("Следующий противник")}</button>
              ) : (
                <button
                  onClick={() => {
                    if (selectedMonster) handleStartBattle(selectedMonster);
                  }}
                  className="rpg-button rpg-button-primary flex-1 text-xs"
                >{localize("Новая серия · ")}{localize(combatEnergyCost)}{localize(" энергии")}</button>
              )}

              {!activeDungeonRun && activeMonster?.regionId !== 'ascension' && <button
                onClick={exitCombat}
                className="rpg-button rpg-button-secondary flex-1 text-xs"
              >{localize("В локацию")}</button>}
            </div>
          </div>
        ) : (
          <div className={`space-y-2 transition-all ${turnPhase === 'monster' ? 'pointer-events-none opacity-60' : 'opacity-100'}`}>
            <div className="combat-action-grid grid grid-cols-2 gap-2">
              {/* Attack */}
              <button
                onClick={() => performPlayerAction('attack')}
                disabled={turnPhase !== 'player'}
                className="combat-action combat-action-attack rpg-button rpg-button-primary min-h-[76px] flex-col text-xs"
              >
                <RpgIcon kind="attack" size={20} />
                <span>{localize("Атака")}</span>
              </button>

              {/* Skills Drawer */}
              <button
                onClick={() => { setIsSkillsOpen(prev => !prev); setIsPotionsOpen(false); }}
                disabled={turnPhase !== 'player'}
                className="combat-action combat-action-skill rpg-button rpg-button-secondary min-h-[76px] flex-col text-xs"
              >
                <RpgIcon kind="skill" size={20} className="text-[#a892bf]" />
                <span>{localize("Навыки")}</span>
              </button>

              {/* Defend */}
              <button
                onClick={() => performPlayerAction('defend')}
                disabled={turnPhase !== 'player'}
                className="combat-action combat-action-defend rpg-button rpg-button-secondary min-h-[76px] flex-col text-xs"
              >
                <RpgIcon kind="defend" size={20} />
                <span>{localize("Защита (+25 MP)")}</span>
              </button>

              {/* Potion */}
              <button
                onClick={() => setIsPotionsOpen(prev => !prev)}
                disabled={turnPhase !== 'player' || potionCount <= 0}
                className={`combat-action combat-action-potion rpg-button min-h-[76px] flex-col text-xs ${
                  potionCount > 0
                    ? 'rpg-button-secondary'
                    : 'rpg-button-secondary opacity-55'
                }`}
              >
                <RpgIcon kind="potion" size={20} className="text-[#76916b]" />
                <span>{localize("Зелье (")}{localize(potionCount)})</span>
              </button>
            </div>
            <button onClick={() => performPlayerAction('flee')} disabled={turnPhase !== 'player'} className="rpg-button rpg-button-secondary min-h-11 w-full text-xs text-[#aaa49a]">{localize("Покинуть бой")}</button>

            {isPotionsOpen && (
              <div className="bg-slate-900/95 border border-emerald-500/40 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-cinzel font-bold border-b border-slate-800 pb-1">
                  <span>{localize("Выберите зелье")}</span>
                  <button onClick={() => setIsPotionsOpen(false)} aria-label={localize("Закрыть выбор зелий")} className="min-h-11 min-w-11 text-xl text-slate-400 hover:text-white">×</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1 max-h-64 overflow-y-auto">
                  {combatPotions.map(potion => {
                    const stats = potion.stats || {};
                    const effects = [
                      stats.heal ? `+${stats.heal} HP` : '',
                      stats.manaRestore ? `+${stats.manaRestore} MP` : '',
                      stats.attackPercent ? `+${stats.attackPercent}% атаки` : '',
                      stats.defensePercent ? `+${stats.defensePercent}% защиты` : '',
                      stats.healFull ? 'Полное HP' : '',
                      stats.invulnerable ? 'Неуязвимость' : ''
                    ].filter(Boolean).map(localize).join(' · ');
                    return (
                      <button
                        key={potion.id}
                        disabled={turnPhase !== 'player'}
                        onClick={() => {
                          performPlayerAction('potion', potion.id);
                          setIsPotionsOpen(false);
                        }}
                        className="p-2 rounded-lg border border-emerald-900/60 bg-slate-950 hover:border-emerald-400 flex items-center gap-2 text-left active:scale-[0.99]"
                      >
                        <ItemArtwork item={potion} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 break-words">{localize(potion.name)}</div>
                          <div className="text-[11px] text-emerald-300">{localize(effects || potion.description)}</div>
                        </div>
                        <span className="text-xs font-mono text-slate-300">×{localize(potion.stackCount || 1)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skills Drawer */}
            {isSkillsOpen && (
              <div className="bg-slate-900/95 border border-indigo-500/40 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-cinzel font-bold border-b border-slate-800 pb-1">
                  <span>{localize("Выберите заклинание или навык")}</span>
                  <button onClick={() => setIsSkillsOpen(false)} aria-label={localize("Закрыть список навыков")} className="min-h-11 min-w-11 text-xl text-slate-400 hover:text-white">×</button>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {player.skills.map(skill => {
                    const manaCost = talentManaCost(skill.manaCost, player.talents);
                    const hasMp = combatPlayerMp >= manaCost;
                    const levelLocked = player.level < skill.levelReq;
                    const onCooldown = (skill.currentCooldown || 0) > 0;
                    const canUse = hasMp && !levelLocked && !onCooldown;
                    return (
                      <button
                        key={skill.id}
                        disabled={!canUse || turnPhase !== 'player'}
                        onClick={() => {
                          performPlayerAction('skill', skill.id);
                          setIsSkillsOpen(false);
                        }}
                        className={`p-2 rounded-lg border flex items-start gap-2 justify-between text-left transition-all ${
                          canUse
                            ? comboReady.includes(skill.id) ? 'bg-cyan-950/40 border-cyan-400 hover:border-cyan-200 active:scale-98 cursor-pointer' : 'bg-slate-950 border-indigo-900/60 hover:border-indigo-400 active:scale-98 cursor-pointer'
                            : 'bg-slate-950/40 border-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <RpgIcon kind="skill" size={16} className="text-[#a892bf]" />
                            <span>{localize(skill.name)}</span>
                            {comboReady.includes(skill.id) && <span className="text-[11px] text-cyan-300">{localize("Связка")}</span>}
                            <span className="text-[11px] text-cyan-300">{localize(skill.id.startsWith('asc_') ? `Ранг ${skill.id.endsWith('_C') ? 'C' : player.ascension?.rank==='SSS' ? 'SSS' : 'S'}` : ['I', 'II', 'III', 'IV'][skillTier(player) - 1])}</span>
                            {skill.isUltimate && (
                              <span className="text-[11px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-500 font-mono">{localize("УЛЬТ")}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{localize(skill.description)}</div>
                          {levelLocked && <div className="text-[11px] text-rose-400 font-mono">{localize("Доступно с уровня ")}{localize(skill.levelReq)}</div>}
                          {onCooldown && <div className="text-[11px] text-amber-300 font-mono">{localize("Перезарядка: ")}{localize(skill.currentCooldown)}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[11px] font-mono block ${hasMp ? 'text-indigo-300' : 'text-rose-400'}`}>
                            {localize(manaCost)} MP
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {player.skills.every(s => !s.hidden) && <div className="col-span-full p-2 text-[11px] text-slate-500">{localize("Неизвестный классовый навык откроется при развитии героя.")}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <details className="bestiary-panel overflow-hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#cfc6b7]">
          <span className="flex items-center gap-2"><RpgIcon kind="bestiary" size={17} className="text-[#b99558]" />{localize("Летопись боя")}</span>
          <span className="font-mono text-[11px] text-[#918c82]">{localize(battleLog.length)}{localize(" записей")}</span>
        </summary>
        <div ref={logContainerRef} className="max-h-40 space-y-1 overflow-y-auto border-t border-[#343638] px-3 py-2 text-xs">
          {battleLog.map(entry => {
            const colorClass =
              entry.type === 'crit' ? 'text-amber-300 font-bold bg-amber-950/20 px-1 rounded' :
              entry.type === 'player-attack' ? 'text-[#cdb681]' :
              entry.type === 'monster-attack' ? 'text-rose-400 font-medium' :
              entry.type === 'heal' ? 'text-emerald-300 font-medium' :
              entry.type === 'death' ? 'text-yellow-300 font-bold bg-yellow-950/30 px-1 rounded' :
              entry.type === 'status' ? 'text-purple-300' :
              'text-slate-300';

            return (
              <div key={entry.id} className="flex items-start gap-1.5 font-mono text-[11px] leading-snug">
                <span className="text-slate-500 shrink-0">[{localize(entry.turn)}]</span>
                <span className={colorClass}>{localize(entry.text)}</span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
};
