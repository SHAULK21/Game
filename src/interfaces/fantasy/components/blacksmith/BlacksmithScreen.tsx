import { sharpeningQuote, sharpeningMultiplier, SHARPENABLE_TYPES } from '../../../../utils/sharpening';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { GameItem } from '../../../../types/game';
import { RARITY_COLORS, getUpgradeRequirements, REGIONS } from '../../../../data/gameData';
import { sound } from '../../../../utils/audio';
import { ItemArtwork } from '../../../../components/ui/ItemArtwork';
import { ClassGearBonus } from '../../../../components/ui/ClassGearBonus';
import { BestiaryPanel, FolioPage, ProgressBar, RpgButton, SectionTitle } from '../ui/BestiaryUI';
import { RpgIcon } from '../ui/RpgIcon';

export const BlacksmithScreen: React.FC = () => {
  const { player, achievements, upgradeItem } = useGame();
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
    <FolioPage className="space-y-3 pt-3">
      {/* Header */}
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#665940] bg-[#111416] text-[#c7a365]">
            <RpgIcon kind="forge" size={24} />
          </div>
          <div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Кузница охотника
            </h2>
            <p title="Заточка доступна до +25. До +5 — гарантированно. Пороги +5/+10/+15/+20 сохраняются при провале. Усиление: +6% за ступень." className="line-clamp-2 text-xs text-slate-300">
              Заточка снаряжения от +0 до +25. До +5 — гарантированно. Пороги +5/+10/+15/+20 сохраняются при провале. Усиление: +6% за ступень.
            </p>
          </div>
        </div>
      </BestiaryPanel>

      {/* Item Selection Carousel / Selector */}
      <div className="space-y-2">
        <SectionTitle eyebrow="Оружие и доспехи" action={<span className="text-xs text-slate-400">{upgradeableItems.length} доступно</span>}>Выберите предмет</SectionTitle>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {upgradeableItems.map(item => {
            const isSelected = currentItem?.id === item.id;
            const rarityStyle = RARITY_COLORS[item.rarity];
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setUpgradeResultMsg(null);
                  sound.playClick();
                }}
                aria-pressed={isSelected}
                className={`min-h-24 w-24 shrink-0 rounded-xl border p-2.5 flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'border-amber-400 bg-amber-950/40 shadow-md '
                    : `${rarityStyle.border} ${rarityStyle.bg} opacity-75 hover:opacity-100`
                }`}
              >
                <ItemArtwork item={item} size={36} />
                <span className="text-[11px] font-medium text-slate-200 truncate w-full text-center">
                  {item.name}
                </span>
                <span className="text-[11px] font-mono text-amber-400 font-bold mt-0.5">
                  +{item.upgradeLevel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Upgrade Anvil Display */}
      {currentItem ? (
        <BestiaryPanel className="space-y-4 p-3">
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
                <span className={`text-[11px] font-bold ${RARITY_COLORS[currentItem.rarity].text}`}>
                  {RARITY_COLORS[currentItem.rarity].label} {currentItem.type}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-mono">Следующий уровень</span>
              <span className="text-sm font-mono font-bold text-amber-300">
                +{currentLevel + 1}
              </span>
            </div>
          </div>

          {/* Stats Preview Before -> After */}
          <ClassGearBonus item={currentItem} characterClass={player.classId} />
          <div className="leather-panel space-y-2 p-3">
            <div className="text-[11px] font-mono text-[#d5ba89] uppercase tracking-wider">
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
            <ProgressBar value={successRatePct} max={100} tone="energy" label="Шанс попытки" />
          </div>

          {/* Costs */}
          <div className="flex items-center justify-between text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">На попытку:</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-amber-300 font-bold"><RpgIcon kind="gold" size={15} />{costGold}</span>
              <span className="inline-flex items-center gap-1 text-slate-200 font-bold"><RpgIcon kind="silver" size={15} />{costSilver + protectionCost}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono px-1">
            {ingredientRows.map(req => {
              const have = player.inventory.reduce((sum, item) => sum + (item.name === req.name ? (item.stackCount ?? 1) : 0), 0);
              return <span key={req.name} className={have >= req.count ? 'text-emerald-300' : 'text-rose-300'}>{req.name} {have}/{req.count}</span>;
            })}
          </div>
          {requirements && <p className="text-[11px] text-slate-500">Руда и катализатор — в шахте; трофей — у мобов локации «{REGIONS.find(r => r.id === requirements.regionId)?.name}». Все материалы расходуются при попытке.</p>}

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
                <RpgIcon kind="defend" size={16} className="text-[#d5ba89]" />
                <span>Защита от понижения уровня (+{protectionCost || Math.max(250, Math.round(costSilver * 1.5))} серебра)</span>
              </span>
            </label>
          )}

          {/* Upgrade Result Alert */}
          {upgradeResultMsg && (
            <div role="status"
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
          {currentItem.serverOwned ? <div className="w-full rounded-xl border border-slate-700 py-3 text-center text-xs text-slate-400">Для заточки серверной вещи нужна серверная кузница и учёт руды.</div> : currentLevel >= 25 ? <div className="w-full rounded-xl border border-emerald-500/40 py-3 text-center text-sm font-bold text-emerald-300">Заточено до предела +25</div> : <RpgButton
            onClick={handleUpgrade}
            disabled={isUpgrading || player.gold < costGold || player.silver < costSilver + protectionCost || !ingredientsReady}
            variant="primary"
            icon="forge"
            className="w-full disabled:opacity-40"
          >
            {isUpgrading ? 'Ковка...' : `Заточить до +${currentLevel + 1}`}
          </RpgButton>
          }
        </BestiaryPanel>
      ) : (
        <BestiaryPanel className="p-8 text-center text-xs text-slate-400">
          Нет предметов для улучшения. Добудьте оружие или броню в бою!
        </BestiaryPanel>
      )}
    </FolioPage>
  );
};
