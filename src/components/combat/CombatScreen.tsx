import { talentManaCost } from '../../data/talents';
import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { 
  Swords, 
  Shield, 
  Sparkles, 
  Zap, 
  Heart, 
  Play, 
  Pause, 
  Settings2,
  Skull,
  Footprints,
  AlertTriangle,
  Gift,
  Plus,
  Hourglass,
  Clock,
  Crown,
  X
} from 'lucide-react';
import { MONSTERS, REGIONS, CAVES, RARITY_COLORS, REGION_MODIFIERS, CLASSES, ASSETS, getRegionMonster } from '../../data/gameData';
import { BattleBackdrop, getBattleScene } from './BattleBackdrop';
import { sound } from '../../utils/audio';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';
import { skillTier } from '../../data/classEvolution';
import { getEnergyElixirPrice } from '../../utils/dungeonRewards';

export const getPredictedMonsterSkill = (monster: NonNullable<ReturnType<typeof useGame>['activeMonster']>) => {
  const ready = (monster.skills || []).filter(skill => (skill.currentCooldown || 0) <= 0 && monster.mp >= skill.manaCost);
  if (!ready.length) return null;
  return [...ready].sort((a, b) =>
    (b.damageMultiplier + (b.effect ? 0.2 : 0)) - (a.damageMultiplier + (a.effect ? 0.2 : 0))
  )[0] || null;
};

export const CombatScreen: React.FC<{ onContinueDungeon?: () => void }> = ({ onContinueDungeon }) => {
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
  const nextMonsterSkill = activeMonster ? getPredictedMonsterSkill(activeMonster) : null;

  const combatPotions = player.inventory.filter(i => i.type === 'potion');
  const potionCount = combatPotions.reduce((sum, item) => sum + (item.stackCount || 1), 0);

  const handleStartBattle = (mon: typeof MONSTERS[string]) => {
    setEnergyError(null);
    if (player.miningExpedition && !premium.active) {
      setEnergyError('Персонаж сейчас в шахте. Сначала нажмите «Уйти с шахты».');
      return;
    }
    const success = startBattleWithMonster(mon);
    if (!success) {
      setEnergyError(`Недостаточно энергии! Требуется ${combatEnergyCost} ⚡, а у вас ${player.energy ?? 0} ⚡.`);
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
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-500/50 bg-[#0a0f1d] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-yellow-950/60 border border-yellow-500/40">
              <Crown className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <div className="font-cinzel font-bold text-yellow-200">Aethelgard Premium</div>
              <div className="text-[11px] text-slate-400">Автобой доступен с Premium</div>
            </div>
          </div>
          <button onClick={() => setPremiumPromptOpen(false)} className="p-1.5 rounded-lg bg-slate-900 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2 text-[11px] text-slate-300">
          <div>⚔️ Автобой и автопродолжение серии</div>
          <div>⛏️ Автоматическая офлайн-добыча</div>
          <div>⚙️ Расширенные настройки автобоя</div>
          <div>👑 VIP-статус</div>
        </div>
        <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-200">150 ⭐</div>
          <div className="text-[10px] text-slate-400">30 дней · Telegram Stars</div>
        </div>
        <button
          disabled={premiumBusy}
          onClick={async () => {
            setPremiumBusy(true);
            setPremiumFeedback(null);
            const result = await purchasePremium(preparedPremiumInvoice);
            setPremiumFeedback(result.message);
            setPremiumBusy(false);
            if (result.success) setTimeout(() => setPremiumPromptOpen(false), 900);
          }}
          className="ui-primary mt-4 w-full py-3 rounded-xl disabled:opacity-50 font-cinzel font-bold text-sm active:scale-95"
        >
          {premiumBusy ? 'Открываю оплату…' : 'Купить Premium · 150 ⭐'}
        </button>
        {premiumFeedback && <div className="mt-2 text-center text-[11px] text-slate-300">{premiumFeedback}</div>}
      </div>
    </div>
  ) : null;

  const isMonsterImg = (avatar: string) => avatar.startsWith('/') || avatar.startsWith('http') || avatar.includes('.');

  // OUT OF COMBAT: Hunting Dashboard
  if (!isInCombat || !activeMonster) {
    return (
      <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
        {premiumModal}
        {/* Banner */}
        <div className="ui-panel relative rounded-2xl overflow-hidden border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              Охотничьи угодья
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {currentRegion.levelRange}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${activeMod.badgeColor}`}>
                {activeMod.icon} {activeMod.name}
              </span>
            </div>
          </div>

          <h2 className="font-cinzel text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>{currentRegion.name}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {currentRegion.description}
          </p>

          {/* Energy notice */}
          <div className="mt-3 flex flex-wrap gap-2 items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-amber-300 font-mono">
              <Zap className="w-4 h-4 fill-amber-400" />
              <span>Серия: <strong className="text-amber-200">{combatEnergyCost} ⚡</strong></span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              Запас: <span className="text-amber-300 font-bold">{player.energy ?? 100} / {player.maxEnergy ?? 100} ⚡</span>
            </div>
          </div>

          {player.miningExpedition && !premium.active && (
            <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40">
              <div className="text-xs font-bold text-amber-200">⛏ Персонаж сейчас в шахте</div>
              <div className="text-[10px] text-slate-400 mt-1">Пока идёт экспедиция, вступать в бой нельзя.</div>
              <button
                onClick={() => {
                  const result = leaveMiningExpedition();
                  setEnergyError(result.message);
                }}
                className="mt-2 w-full py-2 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-bold"
              >
                Уйти с шахты
              </button>
            </div>
          )}

          {/* Energy Warning alert */}
          {energyError && (
            <div className="mt-2.5 p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-xs text-rose-200 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{energyError}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => meditateOrRefillEnergy('meditate')}
                  className="px-2.5 py-1 bg-emerald-950 border border-emerald-500 rounded text-emerald-200 text-[10px] font-bold"
                >
                  🧘 Помедитировать (+10 ⚡)
                </button>
                <button
                  onClick={() => meditateOrRefillEnergy('silver')}
                  className="px-2.5 py-1 bg-amber-950 border border-amber-500 rounded text-amber-200 text-[10px] font-bold"
                >
                  🧪 Эликсир (+30 ⚡ / {getEnergyElixirPrice(premium.active)} 🥈){premium.active ? ' · −50% Premium' : ''}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                if (selectedMonster) handleStartBattle(selectedMonster);
              }}
              className="ui-primary flex-1 py-3 px-4 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              <span>Начать охоту · {combatEnergyCost} ⚡</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(prev => !prev)}
              aria-label="Настройки автобоя"
              className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>

          {!premium.active && (
            <button
              onClick={() => setPremiumPromptOpen(true)}
              className="mt-2 w-full py-2.5 rounded-xl border border-yellow-500/40 bg-yellow-950/25 text-yellow-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-95"
            >
              <Crown className="w-4 h-4" />
              Купить Premium · 150 ⭐ / 30 дней
            </button>
          )}
        </div>

        {/* Auto Battle Configuration Dialog */}
        {isSettingsOpen && (
          <div className="bg-slate-900/95 border border-purple-500/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-cinzel text-xs font-bold text-purple-300">
                Настройки Авто-Боя
              </span>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between text-slate-300">
                <span>Использовать способности:</span>
                <input
                  type="checkbox"
                  checked={autoBattle.useSkills}
                  onChange={e => updateAutoBattleSettings({ useSkills: e.target.checked })}
                  className="rounded text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300">
                <span>Авто-зелье при HP ниже:</span>
                <span className="font-mono text-cyan-400">{autoBattle.healAtHpPercent}%</span>
              </label>

              <input
                type="range"
                min="20"
                max="70"
                value={autoBattle.healAtHpPercent}
                onChange={e => updateAutoBattleSettings({ healAtHpPercent: Number(e.target.value) })}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Combat Stats Overview Card (Showcase Influence of Attributes) */}
        <details className="ui-panel p-3 rounded-xl space-y-2">
          <summary className="cursor-pointer py-1 text-sm text-slate-300">Боевые параметры</summary>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">🩸 Вампиризм</span>
              <span className="text-rose-400 font-bold">+{combatStats.vampirism}% HP</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">⚔️ Пробитие</span>
              <span className="text-amber-300 font-bold">{combatStats.armorPenetration} ед.</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">🎯 Крит. шанс</span>
              <span className="text-cyan-300 font-bold">{Math.round(combatStats.critChance)}% (x{(combatStats.critDamage / 100).toFixed(1)})</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">🛡️ Броня / Маг</span>
              <span className="text-slate-200 font-bold">{combatStats.defense} / {combatStats.magicDefense}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">💨 Уклонение</span>
              <span className="text-indigo-300 font-bold">{Math.round(combatStats.evasion)}%</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">✨ Регенерация</span>
              <span className="text-emerald-400 font-bold">+{combatStats.hpRegen} HP/ход</span>
            </div>
          </div>
        </details>

        {/* Monster Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-cinzel text-xs font-bold text-slate-300 uppercase tracking-wider">
              Обитатели локации
            </h3>
            <span className="text-[11px] text-slate-400">
              Серия: 2–7 врагов
            </span>
          </div>

          <div className="space-y-2">
            {regionMonsters.map(mon => {
              const isSelected = selectedMonster?.id === mon.id;
              const hasImg = isMonsterImg(mon.avatar);

              return (
                <div
                  key={mon.id}
                  onClick={() => setSelectedMonsterId(mon.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#252620] border-[#9d8459]'
                      : 'bg-[#0a0f1a] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {hasImg ? (
                      <img
                        src={mon.avatar}
                        alt={mon.name}
                        className="w-12 h-12 shrink-0 rounded-lg object-cover border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-2xl p-1.5 bg-slate-900 rounded-lg border border-slate-800">
                        {mon.avatar}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-cinzel text-xs font-bold text-slate-100">
                          {mon.name}
                        </span>
                        {mon.isBoss && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-red-950 text-red-300 border border-red-500 rounded">
                            БОСС
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>Ур. {mon.level}</span>
                        <span>·</span>
                        <span>HP: {mon.maxHp}</span>
                        <span>·</span>
                        <span>Атака: {mon.attack}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Трофеи: {mon.drops.filter(drop => drop.type === 'material').map(drop => drop.itemName).join(', ') || 'нет'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleStartBattle(mon);
                    }}
                    className="ui-primary shrink-0 ml-2 px-3 py-3 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Атаковать
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE COMBAT SCREEN
  const monsterHpPct = Math.max(0, Math.min(100, Math.round((activeMonster.hp / activeMonster.maxHp) * 100)));
  const playerHpPct = Math.max(0, Math.min(100, Math.round((combatPlayerHp / combatStats.maxHp) * 100)));
  const playerMpPct = Math.max(0, Math.min(100, Math.round((combatPlayerMp / combatStats.maxMp) * 100)));
  const hasMonImg = isMonsterImg(activeMonster.avatar);
  const playerClass = CLASSES[player.classId] || CLASSES['warrior'];
  const playerHeroImg = playerClass?.image || ASSETS.heroHunter;
  const battleDungeon = activeMonster.regionId !== 'arena' && activeDungeonRun ? CAVES[activeDungeonRun.dungeonId] : undefined;
  const battleRegion = REGIONS.find(region => region.id === activeMonster.regionId) || currentRegion;
  const battleLocationName = activeMonster.regionId === 'arena' ? 'Колизей Чемпионов' : battleDungeon?.name || battleRegion.name;
  const battleScene = getBattleScene(activeMonster.regionId, currentRegion.id, battleDungeon?.id);

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      {premiumModal}
      {/* 1. TOP 1/3 SCREEN BATTLE SHOWCASE (HERO VS MONSTER IMAGERY) */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-[#070b14] h-[33vh] min-h-[220px] max-h-[300px] flex flex-col justify-between p-3 select-none">
        <BattleBackdrop scene={battleScene} dungeonId={battleDungeon?.id} />

        {/* Top combat status bar inside the 1/3 showcase */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <span className="font-bold truncate max-w-[120px]" title={battleLocationName}>{battleLocationName}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-300 text-[10px]">[{activeMod.name}]</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px]">Раунд {combatRound}</span>
            <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border transition-all ${
              turnPhase === 'player'
                ? 'bg-cyan-950/90 border-cyan-400/80 text-cyan-300 shadow-sm  '
                : turnPhase === 'monster'
                ? 'bg-red-950/90 border-red-500/80 text-red-300 shadow-sm  '
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              {turnPhase === 'player' && <span>⚔️ ВАШ ХОД</span>}
              {turnPhase === 'monster' && <span>⏳ ХОД ВРАГА</span>}
              {turnPhase === 'ended' && <span>ФИНИШ</span>}
            </div>
          </div>
        </div>

        {/* Main 1/3 Arena: Hero (Left) vs Center (VS Clash) vs Monster (Right) */}
        <div className="relative z-10 flex-1 grid grid-cols-5 items-center gap-2 py-1">
          {/* Left: Hero Card (2 cols) */}
          <div className={`col-span-2 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
            turnPhase === 'player'
              ? 'ring-1 ring-[#c3a775] bg-slate-950/55'
              : 'opacity-80 bg-slate-900/40'
          }`}>
            {/* Hero Image */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-cyan-400/60 shadow-md bg-slate-950">
              <img
                src={playerHeroImg}
                alt={player.name}
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-center text-[9px] font-mono text-cyan-300 py-0.5 truncate px-1">
                {playerClass.name}
              </span>
              {turnPhase === 'player' && (
                <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-cyan-400 shadow-sm" />
              )}
            </div>

            <div className="w-full mt-1.5 text-center">
              <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                <span className="font-bold text-slate-200 truncate max-w-[70px]">{player.name}</span>
                <span className="text-cyan-400 font-bold text-[10px]">Ур. {player.level}</span>
              </div>

              {/* Hero HP Bar */}
              <div className="mt-1">
                <div className="flex justify-between text-[9px] font-mono text-emerald-400">
                  <span className="font-bold">HP</span>
                  <span className="tabular-nums">{combatPlayerHp}/{combatStats.maxHp}</span>
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-emerald-950 mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300 rounded-full"
                    style={{ width: `${playerHpPct}%` }}
                  />
                </div>
              </div>

              {/* Hero MP Bar */}
              <div className="mt-0.5">
                <div className="flex justify-between text-[9px] font-mono text-indigo-400">
                  <span className="font-bold">MP</span>
                  <span className="tabular-nums">{combatPlayerMp}/{combatStats.maxMp}</span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-indigo-950">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-300 rounded-full"
                    style={{ width: `${playerMpPct}%` }}
                  />
                </div>
              </div>
              {playerEffects.length > 0 && <div className="text-[9px] text-cyan-300 truncate" title={playerEffects.map(e => e.name).join(', ')}>
                {playerEffects.map(e => `${e.name}${e.stacks ? ` ×${e.stacks}` : ''}`).join(' · ')}
              </div>}
            </div>
          </div>

          {/* Center: Clash VS Badge (1 col) */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-cinzel font-bold text-xs  transition-all ${
              turnPhase === 'player'
                ? 'bg-[#302c24] text-[#d5ba89] border border-[#9d8459]'
                : turnPhase === 'monster'
                ? 'bg-[#352329] text-rose-200 border border-rose-400/50'
                : 'bg-slate-800 text-slate-300 border border-slate-600'
            }`}>
              VS
            </div>

            <div className="mt-1 text-center">
              <span className={`text-[9px] font-mono font-bold block ${
                turnPhase === 'player' ? 'text-cyan-300' : 'text-rose-400'
              }`}>
                {turnPhase === 'player' ? 'Вы' : 'Враг'}
              </span>
            </div>
          </div>

          {/* Right: Monster Card (2 cols) */}
          <div className={`col-span-2 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
            turnPhase === 'monster'
              ? 'ring-2 ring-red-500/80 bg-red-950/40   scale-[1.02]'
              : 'opacity-80 bg-slate-900/40'
          }`}>
            {/* Monster Image */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-red-500/60 shadow-md flex items-center justify-center bg-red-950/40">
              {hasMonImg ? (
                <img
                  src={activeMonster.avatar}
                  alt={activeMonster.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-4xl">{activeMonster.avatar}</span>
              )}
              {activeMonster.isBoss && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-bold px-1 rounded-bl">
                  БОСС
                </span>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-center text-[9px] font-mono text-red-300 py-0.5 truncate px-1">
                {activeMonster.name}
              </span>
              {turnPhase === 'monster' && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400 shadow-sm" />
              )}
            </div>

            <div className="w-full mt-1.5 text-center">
              <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                <span className="font-bold text-slate-200 truncate max-w-[70px]">{activeMonster.name}</span>
                <span className="text-red-400 font-bold text-[10px]">Ур. {activeMonster.level}</span>
              </div>

              {/* Monster HP Bar */}
              <div className="mt-1">
                <div className="flex justify-between text-[9px] font-mono text-red-400">
                  <span className="font-bold">HP</span>
                  <span className="tabular-nums">{activeMonster.hp}/{activeMonster.maxHp}</span>
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-red-950 mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-300 rounded-full"
                    style={{ width: `${monsterHpPct}%` }}
                  />
                </div>
              </div>

              {/* Monster Attack info / Status effects */}
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>⚔️ {activeMonster.attack}</span>
                <span>🛡️ {activeMonster.defense}</span>
                {monsterEffects.length > 0 && (
                  <span className="text-purple-300 truncate max-w-[45px]">
                    {monsterEffects.map(e => `${e.name}${e.stacks ? ` ×${e.stacks}` : ''}`).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BUTTONS PLACED DIRECTLY UNDERNEATH THE IMAGES */}
      <div className="space-y-2">
        {/* Turn Status Alert Banner with Auto-Battle Toggle */}
        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
          turnPhase === 'player'
            ? 'bg-[#252620] border-[#9d8459] text-[#d5ba89]'
            : turnPhase === 'monster'
            ? 'bg-red-950/60 border-red-500/60 text-red-200 shadow-md  '
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            {turnPhase === 'player' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#c3a775]" />
                <span className="font-semibold">Ваш ход</span>
                <span className="text-[11px] text-slate-300 hidden sm:inline">— Выберите действие</span>
              </>
            ) : turnPhase === 'monster' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="font-cinzel font-bold text-red-300">ХОД ПРОТИВНИКА</span>
                <span className="text-[11px] text-slate-300 hidden sm:inline">— {activeMonster.name} атакует...</span>
              </>
            ) : (
              <span className="font-cinzel font-bold text-slate-200">БОЙ ЗАВЕРШЕН</span>
            )}
          </div>

          {/* Auto-Battle Toggle */}
          <button
            onClick={handleAutoBattleClick}
            title={premium.active ? 'Автобой' : 'Доступно с Aethelgard Premium'}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
              autoBattle.enabled
                ? 'bg-amber-500 text-slate-950 shadow-sm  '
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {autoBattle.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{premium.active ? (autoBattle.enabled ? 'Авто: ВКЛ' : 'Авто: ВЫКЛ') : 'Автобой · PREMIUM'}</span>
          </button>
        </div>

        {turnPhase === 'player' && activeMonster && !isCombatEnded && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5">
            <div className="flex items-center gap-2 text-amber-200 text-xs font-bold">
              <RpgIcon kind="weapon" size={17} className="text-amber-300" />
              <span>Следующее действие врага</span>
              <span className="ml-auto text-[10px] text-slate-400">после вашего хода</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
              <span className="text-lg">{nextMonsterSkill?.icon || '⚔️'}</span>
              <span className="text-slate-100 font-bold">
                {nextMonsterSkill ? nextMonsterSkill.name : 'Обычная атака'}
              </span>
              {nextMonsterSkill && (
                <span className="ml-auto text-rose-300">×{Math.round(nextMonsterSkill.damageMultiplier * 100)}%</span>
              )}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {nextMonsterSkill?.description || 'Моб нанесёт обычный физический удар, если у него нет доступного навыка.'}
            </div>
          </div>
        )}

        {monsterIntent && turnPhase === 'monster' && (
          <div className="rounded-xl border border-amber-500/60 bg-amber-950/40 p-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <span className="text-lg">{monsterIntent.icon}</span>
              <span>⚠️ {activeMonster.name} сейчас применит «{monsterIntent.name}»</span>
            </div>
            <div className="text-[10px] text-amber-100/70 mt-1">{monsterIntent.description}</div>
          </div>
        )}

        {combatChain && (
          <div className="mb-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-amber-300 font-bold">🔥 Боевая серия</span>
              <span className="text-slate-300">{combatChain.defeated}/{combatChain.total}</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Одна энергия на всю серию · {combatChain.remaining > 0 ? `следующих врагов: ${combatChain.remaining}` : 'серия завершена'}
            </div>
          </div>
        )}

        {/* COMBAT ACTIONS OR COMBAT RESULT */}
        {isCombatEnded ? (
          <div className="p-3.5 bg-slate-900 border border-cyan-500/40 rounded-xl text-center space-y-3">
            <div className="font-cinzel text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
              {combatOutcome === 'victory' && (
                <>
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span>{combatChain && combatChain.remaining > 0 ? 'ВРАГ ПОВЕРЖЕН — СЕРИЯ ПРОДОЛЖАЕТСЯ' : 'ПОБЕДА! СЕРИЯ ЗАВЕРШЕНА'}</span>
                </>
              )}
              {combatOutcome === 'defeat' && '💀 ПОРАЖЕНИЕ В БОЮ'}
              {combatOutcome === 'flee' && '🏃 ВЫ ВЫРВАЛИСЬ ИЗ БОЯ'}
            </div>

            {combatOutcome === 'defeat' && activeMonster?.regionId === 'arena' && lastCombatReward?.arenaRatingGain !== undefined && (
              <div className="text-xs font-bold text-rose-300">🏅 Рейтинг арены: −{Math.abs(lastCombatReward.arenaRatingGain)} PTS</div>
            )}
            {combatOutcome === 'victory' && lastCombatReward && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-left">
                <div className="text-[11px] font-bold text-emerald-300 mb-2">Получено за бой</div>
                {Boolean(lastCombatReward.arenaRatingGain) && <div className="mb-2 text-xs font-bold text-yellow-300">🏅 Рейтинг арены: +{lastCombatReward.arenaRatingGain} PTS</div>}
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-amber-300 font-bold">+{lastCombatReward.gold}</div>
                    <div className="text-slate-500">золото</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-slate-200 font-bold">+{lastCombatReward.silver}</div>
                    <div className="text-slate-500">серебро</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
                    <div className="text-cyan-300 font-bold">+{lastCombatReward.exp}</div>
                    <div className="text-slate-500">EXP</div>
                  </div>
                </div>
                {lastCombatReward.items.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {lastCombatReward.items.map((item, index) => (
                      <div key={item.id + index} className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 p-2 flex items-center gap-2">
                        <ItemArtwork item={item} size={32} />
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-100 leading-tight break-words">{item.name}</div>
                          <div className="text-[9px] text-slate-500">×{item.stackCount || 1} · {item.rarity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] text-slate-500">Предметов не выпало.</div>
                )}
              </div>
            )}

            {combatChain && (
              <div className="rounded-xl bg-black/20 border border-slate-800 p-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Серия противников</span>
                  <span className="text-cyan-300 font-bold">{combatChain.defeated}/{combatChain.total}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${Math.min(100, (combatChain.defeated / combatChain.total) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {combatChain.remaining > 0
                    ? `Осталось ${combatChain.remaining}. Награда за каждого врага сохраняется.`
                    : 'Все враги серии повержены. Для новой серии потребуется энергия.'}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {activeDungeonRun ? (
                <button
                  onClick={onContinueDungeon}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white active:scale-95 transition-all"
                >
                  {activeDungeonRun.completed ? 'Итоги подземелья' : combatOutcome === 'victory' ? 'Продолжить подземелье' : 'Вернуться в подземелье'}
                </button>
              ) : combatOutcome === 'victory' && combatChain && combatChain.remaining > 0 ? (
                <button
                  onClick={startNextCombatBattle}
                  className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white active:scale-95 transition-all"
                >
                  Следующий противник · бесплатно
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (selectedMonster) handleStartBattle(selectedMonster);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white active:scale-95 transition-all"
                >
                  Новая серия ({combatEnergyCost} ⚡)
                </button>
              )}

              {!activeDungeonRun && <button
                onClick={exitCombat}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 active:scale-95 transition-all"
              >
                В локацию
              </button>}
            </div>
          </div>
        ) : (
          <div className={`space-y-2 transition-all ${turnPhase === 'monster' ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            {/* Primary Action Buttons Grid (Row 1) */}
            <div className="grid grid-cols-3 gap-2">
              {/* Attack */}
              <button
                onClick={() => performPlayerAction('attack')}
                disabled={turnPhase !== 'player'}
                className="ui-primary py-3 px-2 rounded-xl font-cinzel font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-cyan-400/40"
              >
                <Swords className="w-4 h-4 text-cyan-200" />
                <span>Атака</span>
              </button>

              {/* Skills Drawer */}
              <button
                onClick={() => { setIsSkillsOpen(prev => !prev); setIsPotionsOpen(false); }}
                disabled={turnPhase !== 'player'}
                className="ui-primary py-3 px-2 rounded-xl font-cinzel font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-indigo-400/40"
              >
                <Zap className="w-4 h-4 text-indigo-200" />
                <span>Навыки</span>
              </button>

              {/* Defend */}
              <button
                onClick={() => performPlayerAction('defend')}
                disabled={turnPhase !== 'player'}
                className="py-3 px-2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-200 font-cinzel font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-slate-700"
              >
                <Shield className="w-4 h-4 text-slate-300" />
                <span>Защита (+25 MP)</span>
              </button>
            </div>

            {/* Secondary Action Buttons Grid (Row 2) */}
            <div className="grid grid-cols-3 gap-2">
              {/* Potion */}
              <button
                onClick={() => setIsPotionsOpen(prev => !prev)}
                disabled={turnPhase !== 'player' || potionCount <= 0}
                className={`py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  potionCount > 0
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 active:scale-95'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-emerald-400" />
                <span>Зелье ({potionCount})</span>
              </button>

              {/* Flee */}
              <button
                onClick={() => performPlayerAction('flee')}
                disabled={turnPhase !== 'player'}
                className="py-2 px-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Footprints className="w-3.5 h-3.5 text-slate-400" />
                <span>Скрыться</span>
              </button>
            </div>

            {isPotionsOpen && (
              <div className="bg-slate-900/95 border border-emerald-500/40 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-cinzel font-bold border-b border-slate-800 pb-1">
                  <span>Выберите зелье</span>
                  <button onClick={() => setIsPotionsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
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
                    ].filter(Boolean).join(' · ');
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
                          <div className="text-xs font-bold text-slate-100 break-words">{potion.name}</div>
                          <div className="text-[10px] text-emerald-300">{effects || potion.description}</div>
                        </div>
                        <span className="text-xs font-mono text-slate-300">×{potion.stackCount || 1}</span>
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
                  <span>Выберите заклинание или навык</span>
                  <button onClick={() => setIsSkillsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
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
                        className={`p-2 rounded-lg border flex items-center justify-between text-left transition-all ${
                          canUse
                            ? comboReady.includes(skill.id) ? 'bg-cyan-950/40 border-cyan-400 hover:border-cyan-200 active:scale-98 cursor-pointer' : 'bg-slate-950 border-indigo-900/60 hover:border-indigo-400 active:scale-98 cursor-pointer'
                            : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span>{skill.icon}</span>
                            <span>{skill.name}</span>
                            {comboReady.includes(skill.id) && <span className="text-[9px] text-cyan-300">🔗 Связка</span>}
                            <span className="text-[9px] text-cyan-300">{['I', 'II', 'III', 'IV'][skillTier(player) - 1]}</span>
                            {skill.isUltimate && (
                              <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-500 font-mono">
                                УЛЬТ
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{skill.description}</div>
                          {levelLocked && <div className="text-[10px] text-rose-400 font-mono">🔒 С уровня {skill.levelReq}</div>}
                          {onCooldown && <div className="text-[10px] text-amber-300 font-mono">⏳ Перезарядка: {skill.currentCooldown}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-mono block ${hasMp ? 'text-indigo-300' : 'text-rose-400'}`}>
                            {manaCost} MP
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{skill.damageMultiplier * 100}% урона</span>
                        </div>
                      </button>
                    );
                  })}
                  {player.skills.every(s => !s.hidden) && <div className="col-span-full text-[10px] text-slate-500 p-2">🔒 Неизвестный классовый навык. Откроется при развитии героя.</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. REAL-TIME COMBAT LOG */}
      <div className="rounded-xl border border-slate-800 bg-[#070a12] p-2.5 h-36 flex flex-col">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between border-b border-slate-800/80 pb-1">
          <span>Журнал пошагового сражения</span>
          <span>{battleLog.length} записей</span>
        </div>

        <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-1 text-xs pr-1">
          {battleLog.map(entry => {
            const colorClass = 
              entry.type === 'crit' ? 'text-amber-300 font-bold bg-amber-950/20 px-1 rounded' :
              entry.type === 'player-attack' ? 'text-cyan-300' :
              entry.type === 'monster-attack' ? 'text-rose-400 font-medium' :
              entry.type === 'heal' ? 'text-emerald-300 font-medium' :
              entry.type === 'death' ? 'text-yellow-300 font-bold bg-yellow-950/30 px-1 rounded' :
              entry.type === 'status' ? 'text-purple-300' :
              'text-slate-300';

            return (
              <div key={entry.id} className="leading-snug flex items-start gap-1.5 font-mono text-[11px]">
                <span className="text-slate-500 shrink-0">[{entry.turn}]</span>
                <span className={colorClass}>{entry.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. COMBAT INFLUENCE CHIPS (Showcase of Attributes Impact) */}
      <div className="p-2.5 rounded-xl bg-[#090e1a] border border-cyan-500/20 text-[10px] font-mono flex items-center justify-between text-slate-300">
        <span>🩸 Вампиризм: <strong className="text-rose-400">+{combatStats.vampirism}%</strong></span>
        <span>⚔️ Пробитие: <strong className="text-amber-300">{combatStats.armorPenetration}</strong></span>
        <span>🛡️ Броня: <strong className="text-slate-200">{combatStats.defense}</strong></span>
        <span>💨 Уклон: <strong className="text-indigo-300">{Math.round(combatStats.evasion)}%</strong></span>
        <span>🎯 Крит: <strong className="text-cyan-300">{Math.round(combatStats.critChance)}%</strong></span>
      </div>
    </div>
  );
};
