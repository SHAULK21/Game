import { sharpeningQuote, sharpeningMultiplier, SHARPENABLE_TYPES } from '../../utils/sharpening';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { GameItem } from '../../types/game';
import { RARITY_COLORS, getUpgradeRequirements, REGIONS } from '../../data/gameData';
import { Hammer, Sparkles, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { sound } from '../../utils/audio';
import { ItemArtwork } from '../ui/ItemArtwork';
import { ClassGearBonus } from '../ui/ClassGearBonus';

export const BlacksmithScreen: React.FC = () => {
  const { player, achievements, upgradeItem, disassembleItem } = useGame();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useProtection, setUseProtection] = useState<boolean>(false);
  const [upgradeResultMsg, setUpgradeResultMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!player) return null;

  // Items eligible for sharpening: equipped or inventory equipment
  const upgradeableItems: GameItem[] = [
    ...Object.values(player.equipped).filter(i=>i && i.type !== 'pickaxe' && i.type !== 'alchemyTool') as GameItem[],
    ...player.inventory.filter(i => SHARPENABLE_TYPES.includes(i.type))
  ];

  const currentItem = upgradeableItems.find(i => i.id === selectedItemId) || upgradeableItems[0] || null;

  const currentLevel = currentItem ? (currentItem.upgradeLevel || 0) : 0;
  const quote = sharpeningQuote(currentLevel, useProtection, achievements.some(a => a.id === 'ach_5' && a.claimed));
  const costGold = quote.gold, costSilver = quote.silver, protectionCost = quote.protection;
  const requirements = currentItem ? getUpgradeRequirements(currentItem, currentLevel) : null;
  const ingredientRows = requirements ? [
    { name: requirements.ore, count: requirements.oreCount },
    { name: requirements.trophy, count: requirements.trophyCount },
    ...(requirements.catalyst ? [{ name: requirements.catalyst, count: requirements.catalystCount }] : [])
  ] : [];
  const ingredientsReady = ingredientRows.every(req => player.inventory.reduce((sum, item) => sum + (item.name === req.name ? (item.stackCount ?? 1) : 0), 0) >= req.count);

  const successRatePct = Math.round(quote.chance * 100);

  const handleUpgrade = () => {
    if (!currentItem || isUpgrading) return;
    setIsUpgrading(true);
    setUpgradeResultMsg(null);
    sound.playMining();

    setTimeout(() => {
      const res = upgradeItem(currentItem, useProtection);
      setUpgradeResultMsg({ text: res.message, success: res.success });
      setIsUpgrading(false);
    }, 450);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Королевская Кузница
            </h2>
            <p className="text-xs text-slate-300">
              Заточка снаряжения от +0 до +25. До +5 — гарантированно. Пороги +5/+10/+15/+20 сохраняются при провале. Усиление: +6% за ступень.
            </p>
          </div>
        </div>
      </div>

      {/* Item Selection Carousel / Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Выберите предмет для улучшения:</span>
          <span>{upgradeableItems.length} доступно</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {upgradeableItems.map(item => {
            const isSelected = currentItem?.id === item.id;
            const rarityStyle = RARITY_COLORS[item.rarity];
            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setUpgradeResultMsg(null);
                  sound.playClick();
                }}
                className={`shrink-0 p-2.5 rounded-xl border flex flex-col items-center justify-center w-24 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-amber-400 bg-amber-950/40 shadow-md '
                    : `${rarityStyle.border} ${rarityStyle.bg} opacity-75 hover:opacity-100`
                }`}
              >
                <ItemArtwork item={item} size={36} />
                <span className="text-[10px] font-medium text-slate-200 truncate w-full text-center">
                  {item.name}
                </span>
                <span className="text-[10px] font-mono text-amber-400 font-bold mt-0.5">
                  +{item.upgradeLevel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Upgrade Anvil Display */}
      {currentItem ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-4">
          {/* Item details */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="p-1 rounded-xl bg-slate-900 border border-slate-800"><ItemArtwork item={currentItem} size={46} /></span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-cinzel text-sm font-bold text-slate-100">
                    {currentItem.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    +{currentLevel}
                  </span>
                </div>
                <span className={`text-[10px] font-bold ${RARITY_COLORS[currentItem.rarity].text}`}>
                  {RARITY_COLORS[currentItem.rarity].label} {currentItem.type}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-mono">Следующий уровень</span>
              <span className="text-sm font-mono font-bold text-amber-300">
                +{currentLevel + 1}
              </span>
            </div>
          </div>

          {/* Stats Preview Before -> After */}
          <ClassGearBonus item={currentItem} characterClass={player.classId} />
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-900 space-y-2">
            <div className="text-[10px] font-mono text-[#d5ba89] uppercase tracking-wider">
              Прирост характеристик (+6% за уровень):
            </div>
            {currentItem.baseAttack && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Физическая атака:</span>
                <span className="text-slate-200 font-bold">
                  {Math.round(currentItem.baseAttack * sharpeningMultiplier(currentLevel))} →{' '}
                  <span className="text-emerald-400">
                    {Math.round(currentItem.baseAttack * sharpeningMultiplier(currentLevel + 1))}
                  </span>
                </span>
              </div>
            )}
            {currentItem.baseDefense && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Физическая защита:</span>
                <span className="text-slate-200 font-bold">
                  {Math.round(currentItem.baseDefense * sharpeningMultiplier(currentLevel))} →{' '}
                  <span className="text-emerald-400">
                    {Math.round(currentItem.baseDefense * sharpeningMultiplier(currentLevel + 1))}
                  </span>
                </span>
              </div>
            )}
            {!currentItem.baseAttack && currentItem.stats.attack && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Атака:</span>
                <span className="text-slate-200">{Math.round(currentItem.stats.attack * sharpeningMultiplier(currentLevel))} → <span className="text-emerald-400">{Math.round(currentItem.stats.attack * sharpeningMultiplier(currentLevel + 1))}</span></span>
              </div>
            )}
            {currentItem.stats.magicAttack && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Магическая атака:</span>
                <span className="text-slate-200">{Math.round(currentItem.stats.magicAttack * sharpeningMultiplier(currentLevel))} → <span className="text-emerald-400">{Math.round(currentItem.stats.magicAttack * sharpeningMultiplier(currentLevel + 1))}</span></span>
              </div>
            )}
            {!currentItem.baseDefense && currentItem.stats.defense && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Защита:</span>
                <span className="text-slate-200">{Math.round(currentItem.stats.defense * sharpeningMultiplier(currentLevel))} → <span className="text-emerald-400">{Math.round(currentItem.stats.defense * sharpeningMultiplier(currentLevel + 1))}</span></span>
              </div>
            )}
          </div>

          {/* Probability & Requirements */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Шанс успеха:</span>
              <span className={`font-bold ${successRatePct >= 70 ? 'text-emerald-400' : successRatePct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                {successRatePct}%
              </span>
            </div>
            <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  successRatePct >= 70 ? 'bg-emerald-500' : successRatePct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${successRatePct}%` }}
              />
            </div>
          </div>

          {/* Costs */}
          <div className="flex items-center justify-between text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">На попытку:</span>
            <div className="flex items-center gap-3">
              <span className="text-amber-300 font-bold">{costGold} 🪙</span>
              <span className="text-slate-200 font-bold">{costSilver + protectionCost} 🥈</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono px-1">
            {ingredientRows.map(req => {
              const have = player.inventory.reduce((sum, item) => sum + (item.name === req.name ? (item.stackCount ?? 1) : 0), 0);
              return <span key={req.name} className={have >= req.count ? 'text-emerald-300' : 'text-rose-300'}>{req.name} {have}/{req.count}</span>;
            })}
          </div>
          {requirements && <p className="text-[10px] text-slate-500">Руда и катализатор — в шахте; трофей — у мобов локации «{REGIONS.find(r => r.id === requirements.regionId)?.name}». Все материалы расходуются при попытке.</p>}

          {/* Protection Checkbox for high levels */}
          {currentLevel >= 8 && (
            <label className="flex items-center gap-2 text-xs text-slate-300 p-2 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={useProtection}
                onChange={e => setUseProtection(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#d5ba89]" />
                <span>Защита от понижения уровня (+{protectionCost || Math.max(250, Math.round(costSilver * 1.5))} 🥈)</span>
              </span>
            </label>
          )}

          {/* Upgrade Result Alert */}
          {upgradeResultMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium text-center ${
                upgradeResultMsg.success
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/60 text-rose-200'
              }`}
            >
              {upgradeResultMsg.text}
            </div>
          )}

          {/* Upgrade Button */}
          {currentItem.serverOwned ? <div className="w-full py-3 rounded-xl border border-slate-700 text-center text-slate-400 text-xs">Для заточки серверной вещи нужна серверная кузница и учёт руды.</div> : currentLevel >= 25 ? <div className="w-full py-3 rounded-xl border border-emerald-500/40 text-center text-emerald-300 text-sm font-bold">✅ Заточено до предела +25</div> : <button
            onClick={handleUpgrade}
            disabled={isUpgrading || player.gold < costGold || player.silver < costSilver + protectionCost || !ingredientsReady}
            className={`w-full py-3 rounded-xl font-cinzel font-bold text-sm flex items-center justify-center gap-2  transition-all active:scale-98 ${
              (player.gold < costGold || player.silver < costSilver + protectionCost || !ingredientsReady)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-slate-950 hover:brightness-110  border border-amber-400'
            }`}
          >
            <Hammer className={`w-4 h-4 ${isUpgrading ? 'animate-spin' : ''}`} />
            <span>{isUpgrading ? 'Ковка...' : `Заточить до +${currentLevel + 1}`}</span>
          </button>
          }
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-400 text-xs">
          Нет предметов для улучшения. Добудьте оружие или броню в бою!
        </div>
      )}
    </div>
  );
};
