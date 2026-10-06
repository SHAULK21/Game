import { useInterface } from '../../../../context/InterfaceContext';
import { BetaHuntDashboard } from './BetaHuntDashboard';
import { potionActionLabel } from '../../../../utils/combatPotions';
import { useMonsterStrike } from '../../../../hooks/useMonsterStrike';
import { t as localize, useLocale } from '../../../../i18n/locale';
import { huntLockReason, regionProgress, huntingModeLockReason } from '../../../../utils/regionalProgress';
import { predictedMonsterSkill } from '../../../../utils/autoBattle';
import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../../../context/GameContext';
import { MONSTERS, REGIONS, CAVES, REGION_MODIFIERS, CLASSES, ASSETS, getRegionMonster } from '../../data/gameData';
import { getBattleScene } from '../../../../components/combat/BattleBackdrop';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';
import { getEnergyElixirPrice } from '../../../../utils/dungeonRewards';
import { HuntDashboard } from './HuntDashboard';
import { CombatArena } from './CombatArena';
import { CombatSkillList } from './CombatSkillList';
import { RpgButton } from '../ui/BestiaryUI';

export const getPredictedMonsterSkill = predictedMonsterSkill;

export const CombatScreen: React.FC<{ onContinueDungeon?: () => void; onReturnToArena?: () => void }> = ({ onContinueDungeon, onReturnToArena }) => {
  useLocale();
  const { style } = useInterface();
  const Dashboard = style === 'fantasy-beta' ? BetaHuntDashboard : HuntDashboard;
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
    monsterForecast,
    combatNarration,
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

  const monsterStriking = useMonsterStrike(battleLog, isInCombat);
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
  const nextMonsterSkill = monsterForecast?.skill || null;

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
        <Dashboard
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
    <div className="folio-page fantasy-combat-page space-y-3 pt-3">
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
        playerAttackId={[...battleLog].reverse().find(entry => entry.type === 'player-attack' || (entry.type === 'crit' && entry.id.startsWith('dmg_')))?.id}
        monsterStriking={monsterStriking}
        battleLog={battleLog}
      />
      {/* Combat status and actions */}
      <div className="combat-command-center space-y-2">
        {battleLog.at(-1)?.id.startsWith('pet_opening_') && <p role="status" className="bestiary-panel px-3 py-2 text-xs leading-relaxed text-[#d8d1c4]">{localize(battleLog.at(-1)!.text)}</p>}
        {combatNarration.length > 0 && <div role="status" className="bestiary-panel px-3 py-2 text-xs leading-relaxed text-[#d8d1c4]">{combatNarration.map((line, i) => <p key={i}>{localize(line)}</p>)}</div>}
        {turnPhase === 'player' && activeMonster && !isCombatEnded && (
          <details className="bestiary-panel overflow-hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs">
              <RpgIcon kind={nextMonsterSkill ? 'skill' : 'attack'} size={17} className="text-[#c7a365]" />
              <span className="min-w-0 flex-1"><span className="mr-1 text-[11px] text-[#918c82]">{localize("Возможный приём:")}</span><strong className="text-[#d8d1c4]">{localize(nextMonsterSkill ? nextMonsterSkill.name : 'Обычная атака')}</strong><span className="mt-1 block text-[11px] leading-relaxed text-[#aaa49a]">{localize('Прогноз может ошибаться или измениться после вашего действия.')}</span></span>
              {nextMonsterSkill && <span className="shrink-0 font-mono text-[11px] text-[#d28f89]">×{localize(Math.round(nextMonsterSkill.damageMultiplier * 100))}%</span>}
            </summary>
            <p className="border-t border-[#343638] px-3 py-2 text-[11px] text-[#aaa49a]">{localize('Точность чтения:')}{' '}{monsterForecast?.accuracy ?? 50}% · {localize('Прогноз может ошибаться.')}</p>
          </details>
        )}

        {monsterIntent && turnPhase === 'monster' && (
          <div className="combat-ledger combat-warning p-3">
            <div className="flex items-center gap-2 combat-ink text-xs font-bold">
              <RpgIcon kind="skill" size={17} />
              <span>{localize(activeMonster.name)}{localize(" применит «")}{localize(monsterIntent.name)}»</span>
            </div>
            <div className="text-[11px] combat-ink mt-1">{localize(monsterIntent.description)}</div>
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
              <div className="text-xs font-bold combat-ink">{localize("Рейтинг арены: −")}{localize(Math.abs(lastCombatReward.arenaRatingGain))} PTS</div>
            )}
            {combatOutcome === 'victory' && activeMonster?.regionId === 'ascension' && (
              <p className="text-xs combat-ink">{localize("Победа сохранена. Вернитесь на арену, чтобы продолжить вознесение.")}{localize(Boolean(lastCombatReward?.silver) && ` Получено ${lastCombatReward?.silver} серебра.`)}</p>
            )}
            {combatOutcome === 'victory' && activeMonster?.regionId !== 'ascension' && (!combatChain || combatChain.remaining === 0) && lastCombatReward && (
              <div className="combat-ledger combat-reward p-3 text-left">
                <div className="text-[11px] font-bold combat-ink mb-2">{localize(combatChain ? 'Награда за серию' : 'Получено за бой')}</div>
                {Boolean(lastCombatReward.arenaRatingGain) && <div className="mb-2 text-xs font-bold combat-ink">{localize("Рейтинг арены: +")}{localize(lastCombatReward.arenaRatingGain)} PTS</div>}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="combat-reward-total p-2 text-center">
                    <div className="combat-ink font-bold">+{localize(lastCombatReward.gold)}</div>
                    <div className="combat-ink">{localize("золото")}</div>
                  </div>
                  <div className="combat-reward-total p-2 text-center">
                    <div className="combat-ink font-bold">+{localize(lastCombatReward.silver)}</div>
                    <div className="combat-ink">{localize("серебро")}</div>
                  </div>
                  <div className="combat-reward-total p-2 text-center">
                    <div className="combat-ink font-bold">+{localize(lastCombatReward.exp)}</div>
                    <div className="combat-ink">EXP</div>
                  </div>
                </div>
                {lastCombatReward.items.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {lastCombatReward.items.map((item, index) => (
                      <div key={item.id + index} className="combat-potion-entry min-w-0 p-2 flex items-center gap-2">
                        <ItemArtwork item={item} size={32} />
                        <div className="min-w-0">
                          <div className="text-[11px] combat-ink leading-tight break-words">{localize(item.name)}</div>
                          <div className="text-[11px] combat-ink">×{localize(item.stackCount || 1)} · {localize(item.rarity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] combat-ink">{localize("Предметов не выпало.")}</div>
                )}
              </div>
            )}

            {combatChain && (
              <div className="combat-ledger p-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="combat-ink">{localize("Серия противников")}</span>
                  <span className="combat-ink font-bold">{localize(combatChain.defeated)}/{localize(combatChain.total)}</span>
                </div>
                <div className="progress-track mt-1.5 h-2 overflow-hidden">
                  <div className="progress-fill is-energy h-full transition-all duration-300" style={{ width: `${Math.min(100, (combatChain.defeated / combatChain.total) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[11px] combat-ink">
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
                aria-expanded={isSkillsOpen}
                aria-controls="combat-skills"
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
                onClick={() => { setIsPotionsOpen(prev => !prev); setIsSkillsOpen(false); }}
                disabled={turnPhase !== 'player' || potionCount <= 0}
                aria-expanded={isPotionsOpen}
                aria-controls="combat-potions"
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
            <div className="combat-secondary-actions flex gap-2">
          <button
            onClick={handleAutoBattleClick}
            title={localize(premium.active ? 'Автобой' : 'Доступно с Aethelgard Premium')}
            className={`combat-auto-toggle pointer-events-auto inline-flex min-h-11 flex-1 justify-center items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-bold transition-colors ${
              autoBattle.enabled
                ? 'border-[#b99558] bg-[#b99558] text-[#14120f]'
                : 'border-[#414345] bg-[#202428] text-[#c8c2b8] hover:text-white'
            }`}
          >
            <RpgIcon kind={autoBattle.enabled ? 'skill' : 'settings'} size={15} />
            <span>{localize(premium.active ? (autoBattle.enabled ? 'Авто: ВКЛ' : 'Авто: ВЫКЛ') : 'Автобой · PREMIUM')}</span>
          </button>
<button onClick={() => performPlayerAction('flee')} disabled={turnPhase !== 'player'} className="rpg-button rpg-button-secondary min-h-11 flex-1 text-xs text-[#aaa49a]">{localize("Покинуть бой")}</button>
            </div>

            {isPotionsOpen && (
              <section id="combat-potions" aria-label={localize("Выберите зелье")} className="combat-ledger p-3 space-y-2 mt-2">
                <div className="combat-ledger-heading">
                  <span>{localize("Выберите зелье")}</span>
                  <button onClick={() => setIsPotionsOpen(false)} aria-label={localize("Закрыть выбор зелий")} className="combat-ledger-close">×</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1 max-h-64 overflow-y-auto">
                  {combatPotions.map(potion => {
                    const stats = potion.stats || {};
                    const effects = [
                      potionActionLabel(potion, player.classId),
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
                        className="combat-potion-entry flex items-center gap-2 text-left"
                      >
                        <ItemArtwork item={potion} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold combat-ink break-words">{localize(potion.name)}</div>
                          <div className="text-[11px] combat-ink">{localize(effects || potion.description)}</div>
                        </div>
                        <span className="text-xs font-mono combat-ink">×{localize(potion.stackCount || 1)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Skills Drawer */}
            {isSkillsOpen && (
              <section id="combat-skills" aria-label={localize("Выберите заклинание или навык")} className="combat-ledger p-3 space-y-2 mt-2">
                <div className="combat-ledger-heading">
                  <span>{localize("Выберите заклинание или навык")}</span>
                  <button onClick={() => setIsSkillsOpen(false)} aria-label={localize("Закрыть список навыков")} className="combat-ledger-close">×</button>
                </div>

                <CombatSkillList player={player} mana={combatPlayerMp} comboReady={comboReady} playerTurn={turnPhase === 'player'} onUse={id => {
                  performPlayerAction('skill', id);
                  setIsSkillsOpen(false);
                }} />
              </section>
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
              entry.type === 'crit' ? 'combat-ink font-bold  px-1 rounded' :
              entry.type === 'player-attack' ? 'text-[#cdb681]' :
              entry.type === 'monster-attack' ? 'combat-ink font-medium' :
              entry.type === 'heal' ? 'combat-ink font-medium' :
              entry.type === 'death' ? 'combat-ink font-bold  px-1 rounded' :
              entry.type === 'status' ? 'combat-ink' :
              'combat-ink';

            return (
              <div key={entry.id} className="flex items-start gap-1.5 font-mono text-[11px] leading-snug">
                <span className="combat-ink shrink-0">[{localize(entry.turn)}]</span>
                <span className={colorClass}>{localize(entry.text)}</span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
};
