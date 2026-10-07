import { HeroEquipment } from '../../interfaces/modern/HeroEquipment';
import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { STAT_LABELS } from '../../utils/statLabels';
import { getAlchemyToolBonus } from '../../utils/alchemy';
import { getPickaxeBonus } from '../../utils/mining';
import { ASCENSION_FRAGMENT_DESCRIPTION } from '../../data/ascension';
import { BulkInventoryActions } from './BulkInventoryActions';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { GameItem, ItemType, CharacterClassId } from '../../types/game';
import { RARITY_COLORS } from '../../data/gameData';
import {
  Shield,
  Sparkles,
  Coins,
  Hammer,
  Plus,
  CheckCircle,
  X,
  FlaskConical,
  Pickaxe,
  Gem,
  Swords,
  Crown
} from 'lucide-react';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';
import { ClassGearBonus } from '../ui/ClassGearBonus';
import { getEffectiveGearStats } from '../../utils/classEquipment';

interface InventoryScreenProps {
  onNavigateToBlacksmith?: () => void;
  onNavigateToCrafting?: () => void;
}

type InventoryTab = 'equipment' | 'potions' | 'resources';

const EQUIPMENT_TYPES: ItemType[] = [
  'weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves',
  'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact', 'pickaxe', 'alchemyTool'
];

const TYPE_LABELS: Partial<Record<ItemType, string>> = {
  pickaxe: 'Кирка',
  alchemyTool: 'Реторта',
  weapon: 'Оружие',
  offhand: 'Второе оружие',
  helmet: 'Шлем',
  armor: 'Доспех',
  pants: 'Штаны',
  gloves: 'Перчатки',
  boots: 'Сапоги',
  amulet: 'Амулет',
  ring: 'Кольцо',
  belt: 'Пояс',
  cloak: 'Плащ',
  artifact: 'Артефакт',
  potion: 'Зелье',
  ore: 'Руда',
  material: 'Материал'
};



const PERCENT_STATS = new Set([
  'critChance', 'critDamage', 'vampirism', 'accuracy', 'evasion',
  'physicalResistance', 'magicResistance', 'fireResistance',
  'iceResistance', 'lightningResistance', 'poisonResistance',
  'darkResistance', 'holyResistance', 'attackPercent', 'defensePercent'
]);

const getItemStats = (item?: GameItem | null, characterClass?: CharacterClassId): Record<string, number> => {
  if (!item) return {};
  return getEffectiveGearStats(item, characterClass);
};

const getItemScore = (item: GameItem, characterClass?: CharacterClassId): number => {
  const stats = getItemStats(item, characterClass);
  return Math.round(
    (stats.attack || 0) * 2 +
    (stats.magicAttack || 0) * 2 +
    (stats.defense || 0) * 1.4 +
    (stats.magicDefense || 0) * 1.4 +
    (stats.maxHp || 0) * 0.05 +
    (stats.maxMp || 0) * 0.04 +
    (stats.critChance || 0) * 1.1 +
    (stats.critDamage || 0) * 0.25 +
    (stats.vampirism || 0) * 1.2 +
    (stats.speed || 0) * 0.5 +
    (stats.armorPenetration || 0) * 0.8
  );
};

const formatStat = (stat: string, value: number) =>
  PERCENT_STATS.has(stat) ? `${value}%` : String(Math.round(value));

const ItemTypeIcon: React.FC<{ type: ItemType; className?: string }> = ({ type, className = 'text-slate-500' }) => { useLocale(); return (<RpgIcon kind={type} size={22} className={className} />); };

const getDisassemblePreview = (item: GameItem) => {
  const parts: string[] = [];
  const ore = item.disassembleYield?.ore || 0;
  const silver = item.disassembleYield?.silver || 0;
  if (ore > 0) parts.push(`Железная руда ×${ore}`);
  if (silver > 0) parts.push(`серебро ×${silver}`);
  return parts.length ? parts.map(localize).join(' + ') : 'без ресурсов';
};

const getResourceUse = (item: GameItem) => {
  if (item.templateId === 'ascension_fragment') return ASCENSION_FRAGMENT_DESCRIPTION;
  if (item.type === 'ore') return 'Кузница · заточка экипировки';
  if (item.name === 'Сырой самоцвет') return 'Огранка · переработка в серебро';
  if (item.name === 'Лечебная трава' || item.name === 'Чистая вода' || item.name === 'Лунная пыльца' || item.name === 'Ядовитая железа' || item.name === 'Острый клык' || item.name === 'Огненный цветок' || item.name === 'Горный корень' || item.name === 'Магическая эссенция') {
    return 'Алхимия · создание зелий';
  }
  return 'Ремесло и специальные рецепты';
};

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onNavigateToBlacksmith, onNavigateToCrafting }) => {
  useLocale();
  const {
    player,
    combatStats,
    equipItem,
    unequipItem,
    sellItem,
    disassembleItem,
    toggleItemLock,
    expandInventory,
    premium,
    purchasePremium
  } = useGame();

  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [tab, setTab] = useState<InventoryTab>('equipment');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedItem) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItem(null);
      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [selectedItem?.id]);

  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumFeedback, setPremiumFeedback] = useState<string | null>(null);

  if (!player) return null;

  const handleInventoryExpansion = async () => {
    if (premium.active) {
      const result = await expandInventory();
      setPremiumFeedback(result.message);
      return;
    }

    setPremiumBusy(true);
    setPremiumFeedback(null);
    const result = await purchasePremium();
    setPremiumFeedback(result.message);
    setPremiumBusy(false);
  };

  const currentSelected = selectedItem
    ? player.inventory.find(i => i.id === selectedItem.id) || Object.values(player.equipped).find(i => i?.id === selectedItem.id) || selectedItem
    : null;

  const equipment = useMemo(
    () => player.inventory
      .filter(item => EQUIPMENT_TYPES.includes(item.type))
      .sort((a, b) => {
        const aCurrent = player.equipped[a.type]?.id === a.id ? 1 : 0;
        const bCurrent = player.equipped[b.type]?.id === b.id ? 1 : 0;
        return bCurrent - aCurrent || getItemScore(b, player.classId) - getItemScore(a, player.classId);
      }),
    [player.inventory, player.equipped, player.classId]
  );

  const potions = useMemo(
    () => player.inventory.filter(item => item.type === 'potion'),
    [player.inventory]
  );

  const groupedResources = useMemo(() => {
    const map = new Map<string, GameItem>();
    for (const item of player.inventory.filter(i => i.type === 'ore' || i.type === 'material')) {
      const key = `${item.templateId}:${item.name}:${item.rarity}`;
      const existing = map.get(key);
      if (existing) {
        existing.stackCount = (existing.stackCount || 1) + (item.stackCount || 1);
      } else {
        map.set(key, { ...item });
      }
    }
    return [...map.values()];
  }, [player.inventory]);

  const selectedIsEquipment = Boolean(currentSelected && EQUIPMENT_TYPES.includes(currentSelected.type));
  const currentEquipped = selectedIsEquipment && currentSelected
    ? player.equipped[currentSelected.type]
    : undefined;
  const selectedStats = getItemStats(currentSelected, player.classId);
  const currentStats = getItemStats(currentEquipped, player.classId);
  const statKeys = [...new Set([...Object.keys(currentStats), ...Object.keys(selectedStats)])];

  const selectedScore = currentSelected && selectedIsEquipment ? getItemScore(currentSelected, player.classId) : 0;
  const currentScore = currentEquipped ? getItemScore(currentEquipped, player.classId) : 0;
  const scoreDelta = selectedIsEquipment ? selectedScore - currentScore : 0;

  const renderItemCard = (item: GameItem) => {
    const rarityStyle = RARITY_COLORS[item.rarity];
    const equipped = player.equipped[item.type]?.id === item.id;

    return (
      <button
        key={item.id}
        data-inventory-item={item.id}
        onClick={async () => setSelectedItem(item)}
        className={`modern-item-card relative text-left p-2 rounded-xl border min-h-[104px] transition-all active:scale-[0.98] ${rarityStyle.border} ${rarityStyle.bg} ${equipped ? 'ring-1 ring-cyan-400/70' : 'hover:border-slate-500'}`}
      >
        {equipped && (
          <span className="absolute top-1 left-1 text-[8px] font-bold px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">{localize("НАДЕТО")}</span>
        )}
        <div className="flex items-center justify-center h-9 mt-1">
          <ItemArtwork item={item} size={40} />
        </div>
        <div
          className="mt-1 text-[9px] leading-[11px] text-slate-100 font-medium text-center break-words overflow-hidden min-h-[32px] max-h-[32px]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={localize(item.name)}
        >
          {localize(item.name)}
        </div>
        <div className="text-[9px] text-slate-400 flex items-center justify-between gap-1">
          <span>{localize("Ур.")}{localize(item.level)}</span>
          <span className="text-amber-300 font-bold">{localize(item.upgradeLevel > 0 ? `+${item.upgradeLevel}` : '+0')}</span>
        </div>
        <ClassGearBonus item={item} characterClass={player.classId} compact />
      </button>
    );
  };

  const renderResource = (item: GameItem) => (
    <button
      key={item.id}
      onClick={async () => setSelectedItem(item)}
      className="w-full p-2.5 rounded-xl border border-slate-800 bg-[#0a0f1d] flex items-center gap-3 text-left active:scale-[0.99]"
    >
      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
        <ItemArtwork item={item} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-100 truncate">{localize(item.name)}</span>
          <span className={`text-[9px] font-bold ${RARITY_COLORS[item.rarity].text}`}>{localize(RARITY_COLORS[item.rarity].label)}</span>
        </div>
        <div className="text-[10px] text-cyan-300 mt-0.5">{localize(getResourceUse(item))}</div>
      </div>
      <span className="text-sm font-mono font-bold text-slate-200">×{localize(item.stackCount || 1)}</span>
    </button>
  );

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      <details className="modern-inventory-equipment ui-panel rounded-2xl p-3"><summary className="cursor-pointer font-cinzel text-sm text-amber-200">{localize("Снаряжение")}</summary><HeroEquipment onSelect={setSelectedItem} /><div className="flex gap-2 mt-3">{(['pickaxe', 'alchemyTool'] as ItemType[]).map(type => { const item = player.equipped[type]; return <button key={type} className="game-section flex-1 rounded-lg p-3 text-xs" onClick={async () => item && setSelectedItem(item)}>{localize(TYPE_LABELS[type])}: {localize(item?.name || 'Пусто')}</button>; })}</div></details>
      <div className="flex items-center justify-between">
        <div>
          <span className="font-cinzel text-xs font-bold text-slate-200">{localize("Сумка")}</span>
          <span className="ml-1.5 text-xs font-mono text-cyan-400">
            {localize(player.inventory.length)}/{localize(player.maxInventorySlots)}
          </span>
        </div>
        <button
          onClick={handleInventoryExpansion}
          disabled={premium.loading || premiumBusy}
          title={localize(premium.active ? `Расширить сумку на 5 слотов за ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} золота` : 'Подключить Premium и расширить инвентарь')}
          className="text-[10px] px-2 py-1.5 rounded-lg border border-amber-700/60 bg-amber-950/30 text-amber-200 flex items-center gap-1 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
        >
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          {localize(premiumBusy ? 'Открываю…' : premium.active ? `+5 слотов · ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} 🪙` : '+5 слотов · Только Premium')}
        </button>
      </div>
      {premium.active && <p className="-mt-1 text-[10px] text-slate-400">{localize("Расширение стоит ")}{localize((player.maxInventorySlots * 60).toLocaleString(intlLocale()))}{localize(" золота. У вас: ")}{localize(player.gold.toLocaleString(intlLocale()))}{localize(" 🪙. Купленные слоты остаются после окончания Premium.")}</p>}
      {premiumFeedback && (
        <div className="-mt-1 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[10px] leading-4 text-amber-200/80">
          {localize(premiumFeedback)}
        </div>
      )}
      {!premium.active && !premium.loading && (
        <div className="-mt-1 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[10px] leading-4 text-amber-200/80">{localize("👑 Расширение сумки доступно только с активным Premium. Базовые ")}{localize(player.maxInventorySlots)}{localize(" слотов остаются доступны всегда.")}</div>
      )}

      {!premium.active && <BulkInventoryActions />}

      <div className="grid grid-cols-3 gap-1.5">
        {([
          ['equipment', 'Экипировка', EQUIPMENT_TYPES.filter(type => player.inventory.some(item => item.type === type)).length],
          ['potions', 'Зелья', potions.length],
          ['resources', 'Ресурсы', groupedResources.length]
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            onClick={async () => setTab(id)}
            className={`py-2 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 ${tab === id ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
          >
            {id === 'equipment' ? <Shield className="w-3.5 h-3.5" /> : id === 'potions' ? <FlaskConical className="w-3.5 h-3.5" /> : <Pickaxe className="w-3.5 h-3.5" />}
            {localize(label)} <span className="opacity-70">({localize(count)})</span>
          </button>
        ))}
      </div>

      {tab === 'equipment' && (
        equipment.length > 0 ? (
          <div className="modern-item-grid grid grid-cols-4 gap-2">{localize(equipment.map(renderItemCard))}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">{localize("Здесь появится добытая экипировка.")}</div>
        )
      )}

      {tab === 'potions' && (
        potions.length > 0 ? (
          <div className="space-y-2">
            {potions.map(item => (
              <button
                key={item.id}
                onClick={async () => setSelectedItem(item)}
                className="w-full rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <ItemArtwork item={item} size={40} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 truncate">{localize(item.name)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{localize(item.description)}</div>
                </div>
                <span className="font-mono text-sm text-emerald-300">×{localize(item.stackCount || 1)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">{localize("Зелий нет.")}</div>
        )
      )}

      {tab === 'resources' && (
        <div className="space-y-3">
          <button
            onClick={onNavigateToCrafting}
            className="w-full rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-left text-xs text-amber-200"
          >{localize("⚒️ Открыть мастерскую снаряжения — рецепты, трофеи мобов и ресурсы шахты")}</button>

          {groupedResources.length > 0 ? (
            <div className="space-y-1.5">{localize(groupedResources.map(renderResource))}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">{localize("Ресурсов пока нет.")}</div>
          )}
        </div>
      )}

      {currentSelected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={async () => setSelectedItem(null)}
        >
          <div
            ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modern-item-title"
            className={`modern-item-details w-full max-w-lg rounded-2xl border p-3.5 bg-[#080c15]  ${RARITY_COLORS[currentSelected.rarity].border}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <ItemArtwork item={currentSelected} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 id="modern-item-title" className="font-cinzel text-sm font-bold text-slate-100 break-words">
                      {localize(currentSelected.name)}
                    </h3>
                    <span className="text-amber-300 text-xs font-mono">+{localize(currentSelected.upgradeLevel)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {localize(TYPE_LABELS[currentSelected.type])}{localize(" · Ур. ")}{localize(currentSelected.level)} · {localize(RARITY_COLORS[currentSelected.rarity].label)}
                  </div>
                  {currentSelected.serverOwned && <div className="text-[10px] text-emerald-300 mt-0.5">{localize("✓ Серверный предмет")}{localize(currentSelected.boundToClan ? ' · привязан к клану' : '')}</div>}
                  {(currentSelected.armorClass || currentSelected.weaponClass) && <div className="text-[10px] text-cyan-300 mt-0.5">
                    {localize(({heavy:'Тяжёлая броня',medium:'Средняя броня',light:'Лёгкая броня',twoHanded:'Двуручное оружие',dagger:'Кинжал',staff:'Посох',shield:'Щит',bow:'Лук'} as Record<string,string>)[currentSelected.armorClass || currentSelected.weaponClass || ''])}
                  </div>}
                </div>
              </div>
              <button onClick={async () => setSelectedItem(null)} aria-label={localize("Закрыть")} className="p-1 text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedIsEquipment ? (
              <div className="mt-3 space-y-2">
                <ClassGearBonus item={currentSelected} characterClass={player.classId} />
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="text-slate-500">{localize("СРАВНЕНИЕ С ТЕКУЩИМ")}</span>
                    <span className={scoreDelta > 0 ? 'text-emerald-300 font-bold' : scoreDelta < 0 ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                      {localize(currentEquipped ? `Сила ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}` : 'Слот пуст')}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2 mb-2">
                    <div className="rounded-lg bg-slate-900 p-2">
                      <div className="text-[9px] text-slate-500 mb-1">{localize("СЕЙЧАС")}</div>
                      <div className="text-[10px] font-bold text-slate-200 truncate">{localize(currentEquipped?.name || 'Слот пуст')}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{localize(currentEquipped ? `Ур.${currentEquipped.level} +${currentEquipped.upgradeLevel}` : '—')}</div>
                    </div>
                    <div className="rounded-lg bg-cyan-950/20 border border-cyan-500/20 p-2">
                      <div className="text-[9px] text-cyan-400 mb-1">{localize("ВЫБРАНО")}</div>
                      <div className="text-[10px] font-bold text-slate-100 truncate">{localize(currentSelected.name)}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{localize("Ур.")}{localize(currentSelected.level)} +{localize(currentSelected.upgradeLevel)}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {statKeys.map(stat => {
                      const selectedValue = selectedStats[stat] || 0;
                      const currentValue = currentStats[stat] || 0;
                      const delta = selectedValue - currentValue;
                      return (
                        <div key={stat} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[10px]">
                          <span className="text-slate-400">{localize(STAT_LABELS[stat] || stat)}</span>
                          <span className="font-mono text-slate-500">{localize(formatStat(stat, currentValue))}</span>
                          <span className={`font-mono font-bold min-w-[68px] text-right ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                            {localize(delta > 0 ? '+' : '')}{localize(formatStat(stat, delta))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  {localize((currentSelected.type === 'pickaxe' || currentSelected.type === 'alchemyTool') ? currentSelected.description : 'Сравнение считает базовые и дополнительные характеристики. Заточка отображается отдельно и тоже влияет на боевую силу.')}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[10px] text-cyan-400 font-mono uppercase">{localize("Назначение")}</div>
                <div className="text-xs text-slate-200">
                  {localize(currentSelected.type === 'potion' ? currentSelected.description : getResourceUse(currentSelected))}
                </div>
                {Object.keys(getItemStats(currentSelected)).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    {Object.entries(getItemStats(currentSelected)).map(([stat, value]) => (
                      <div key={stat} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">{localize(STAT_LABELS[stat] || stat)}</span>
                        <span className="text-emerald-300 font-mono">+{localize(formatStat(stat, value))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentSelected.stackCount && currentSelected.stackCount > 1 && (
                  <div className="text-[10px] text-slate-400">{localize("В стопке: ")}{localize(currentSelected.stackCount)}</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={async () => toggleItemLock(currentSelected.id)}
                className="py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-amber-200 text-xs font-bold"
              >
                {localize(currentSelected.isLocked ? '🔓 Отпереть' : '🔒 Запереть')}
              </button>
              {currentSelected.isEquipped ? (
                <button
                  onClick={async () => {
                    const result=await unequipItem(currentSelected.type);
                    setPremiumFeedback(result.message);
                    if(result.success) setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />{localize(" Снять")}</button>
              ) : selectedIsEquipment ? (
                <button
                  onClick={async () => {
                    const result=await equipItem(currentSelected);
                    setPremiumFeedback(result.message);
                    if(result.success) setSelectedItem(null);
                  }}
                  disabled={!['pickaxe','alchemyTool'].includes(currentSelected.type) && currentSelected.level > player.level || currentSelected.type==='pickaxe' && player.miningLevel<(getPickaxeBonus(currentSelected)?.miningLevel||1) || currentSelected.type==='alchemyTool' && !getAlchemyToolBonus(currentSelected,player.alchemyLevel)}
                  className="py-2.5 rounded-xl bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {localize(!['pickaxe','alchemyTool'].includes(currentSelected.type) && currentSelected.level > player.level ? `Нужен уровень ${currentSelected.level}` : currentSelected.type==='pickaxe' && player.miningLevel<(getPickaxeBonus(currentSelected)?.miningLevel||1) ? 'Недостаточный уровень шахты' : currentSelected.type==='alchemyTool' && !getAlchemyToolBonus(currentSelected,player.alchemyLevel) ? 'Недостаточный уровень алхимии' : 'Экипировать')}
                </button>
              ) : (
                <button
                  disabled
                  className="py-2.5 rounded-xl bg-slate-900 text-slate-600 text-xs font-bold"
                >{localize("Только ресурс")}</button>
              )}

              {selectedIsEquipment && onNavigateToBlacksmith && (
                <button
                  onClick={async () => {
                    setSelectedItem(null);
                    onNavigateToBlacksmith();
                  }}
                  className="py-2.5 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Hammer className="w-4 h-4 text-purple-400" />{localize(" В кузницу")}</button>
              )}

              {!currentSelected.isLocked && ((selectedIsEquipment && !currentSelected.isEquipped) || Boolean(currentSelected.disassembleYield?.silver)) && (
                <button
                  onClick={async () => {
                    disassembleItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  {localize(currentSelected.name === 'Сырой самоцвет'
                    ? `Огранить → ${getDisassemblePreview(currentSelected)}`
                    : `Разобрать → ${getDisassemblePreview(currentSelected)}`)}
                </button>
              )}

              {!currentSelected.isEquipped && !currentSelected.isLocked && (
                <button
                  onClick={async () => {
                    sellItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-4 h-4" />{localize(" Продать за ")}{localize(currentSelected.sellPrice || 0)} 🪙
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {premium.active && <BulkInventoryActions />}
      <div className="text-[9px] text-slate-600 text-center">{localize("Руда из шахты теперь расходуется на заточку: чем выше +, тем более редкая руда нужна.")}</div>
    </div>
  );
};
