import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { GameItem } from '../../types/game';
import { RARITY_COLORS } from '../../data/gameData';
import { Hammer, Sparkles, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { sound } from '../../utils/audio';

export const BlacksmithScreen: React.FC = () => {
  const { player, upgradeItem, disassembleItem } = useGame();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useProtection, setUseProtection] = useState<boolean>(false);
  const [upgradeResultMsg, setUpgradeResultMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!player) return null;

  // Items eligible for sharpening: equipped or inventory equipment
  const upgradeableItems: GameItem[] = [
    ...Object.values(player.equipped).filter(Boolean) as GameItem[],
    ...player.inventory.filter(i => ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'ring', 'amulet'].includes(i.type))
  ];

  const currentItem = upgradeableItems.find(i => i.id === selectedItemId) || upgradeableItems[0] || null;

  const currentLevel = currentItem ? (currentItem.upgradeLevel || 0) : 0;
  const costGold = Math.round(120 * Math.pow(1.48, currentLevel));
  const costShards = Math.max(2, Math.ceil(2 + currentLevel * 0.55));
  const oreTiers = [
    { name: 'Уголь', icon: '🪨', base: 3 }, { name: 'Медная руда', icon: '🟤', base: 4 },
    { name: 'Железная руда', icon: '⚪', base: 5 }, { name: 'Серебряная руда', icon: '✨', base: 6 },
    { name: 'Золотая руда', icon: '🪙', base: 7 }, { name: 'Мифриловая руда', icon: '💎', base: 8 },
    { name: 'Адамантит', icon: '🟣', base: 10 }, { name: 'Драконит', icon: '🔥', base: 12 }
  ];
  const oreReq = oreTiers[Math.min(oreTiers.length - 1, Math.floor(currentLevel / 3))];
  const oreCount = oreReq.base + Math.floor(currentLevel / 4);
  const oreHave = player.inventory.reduce((sum, item) => sum + (item.name === oreReq.name ? (item.stackCount || 1) : 0), 0);

  // Success rate formula
  let successRatePct = 100;
  if (currentLevel === 1) successRatePct = 90;
  else if (currentLevel === 2) successRatePct = 82;
  else if (currentLevel === 3) successRatePct = 74;
  else if (currentLevel === 4) successRatePct = 66;
  else if (currentLevel === 5) successRatePct = 58;
  else if (currentLevel === 6) successRatePct = 50;
  else if (currentLevel === 7) successRatePct = 43;
  else if (currentLevel === 8) successRatePct = 36;
  else if (currentLevel === 9) successRatePct = 30;
  else if (currentLevel >= 10 && currentLevel < 15) successRatePct = 22;
  else if (currentLevel >= 15 && currentLevel < 20) successRatePct = 14;
  else if (currentLevel >= 20) successRatePct = 7;

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
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#17100b] to-[#0a0d16] p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Hammer className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Королевская Кузница
            </h2>
            <p className="text-xs text-slate-300">
              Заточка снаряжения от +0 до +25 с усилением характеристик.
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
                    ? 'border-amber-400 bg-amber-950/40 shadow-md shadow-amber-950'
                    : `${rarityStyle.border} ${rarityStyle.bg} opacity-75 hover:opacity-100`
                }`}
              >
                <span className="text-2xl mb-1">{item.icon}</span>
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
        <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-4 shadow-xl">
          {/* Item details */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-800">
                {currentItem.icon}
              </span>
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
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-900 space-y-2">
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
              Прирост характеристик (+12% за уровень):
            </div>
            {currentItem.baseAttack && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Физическая атака:</span>
                <span className="text-slate-200 font-bold">
                  {Math.round(currentItem.baseAttack * (1 + currentLevel * 0.12))} →{' '}
                  <span className="text-emerald-400">
                    {Math.round(currentItem.baseAttack * (1 + (currentLevel + 1) * 0.12))}
                  </span>
                </span>
              </div>
            )}
            {currentItem.baseDefense && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Физическая защита:</span>
                <span className="text-slate-200 font-bold">
                  {Math.round(currentItem.baseDefense * (1 + currentLevel * 0.12))} →{' '}
                  <span className="text-emerald-400">
                    {Math.round(currentItem.baseDefense * (1 + (currentLevel + 1) * 0.12))}
                  </span>
                </span>
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
              <span className="text-cyan-300 font-bold">{costShards} 💠</span>
              <span className={oreHave >= oreCount ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                {oreReq.icon} {oreHave}/{oreCount}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 px-1">
            Руда: <span className="text-slate-300">{oreReq.name}</span>. Она добывается в шахте и полностью расходуется при попытке заточки.
          </div>

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
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Использовать свиток защиты от понижения уровня</span>
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
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading || player.gold < costGold || player.shards < costShards || oreHave < oreCount}
            className={`w-full py-3 rounded-xl font-cinzel font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
              (player.gold < costGold || player.shards < costShards || oreHave < oreCount)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-slate-950 hover:brightness-110 shadow-amber-500/25 border border-amber-400'
            }`}
          >
            <Hammer className={`w-4 h-4 ${isUpgrading ? 'animate-spin' : ''}`} />
            <span>{isUpgrading ? 'Ковка...' : `Заточить до +${currentLevel + 1}`}</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-400 text-xs">
          Нет предметов для улучшения. Добудьте оружие или броню в бою!
        </div>
      )}
    </div>
  );
};
