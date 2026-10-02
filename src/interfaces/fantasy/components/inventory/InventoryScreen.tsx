import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { STAT_LABELS } from '../../../../utils/statLabels';
import { getAlchemyToolBonus } from '../../../../utils/alchemy';
import { getPickaxeBonus } from '../../../../utils/mining';
import { ASCENSION_FRAGMENT_DESCRIPTION } from '../../../../data/ascension';
import { BulkInventoryActions } from './BulkInventoryActions';
import React, { useMemo, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { GameItem, ItemType, CharacterClassId } from '../../../../types/game';
import { RARITY_COLORS, CLASSES, ASSETS } from '../../data/gameData';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';
import { ClassGearBonus } from '../../../../components/ui/ClassGearBonus';
import { getEffectiveGearStats } from '../../../../utils/classEquipment';
import { BestiaryPanel, CodexTabs, FolioPage, OrnamentDivider, RpgButton } from '../ui/BestiaryUI';

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
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumFeedback, setPremiumFeedback] = useState<string | null>(null);

  if (!player) return null;

  const handleInventoryExpansion = async () => {
    if (premium.active) {
      const result = expandInventory();
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
        onClick={() => setSelectedItem(item)}
        className={`rarity-frame relative min-h-[104px] rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] ${rarityStyle.border} ${rarityStyle.bg} ${equipped ? 'ring-1 ring-[#b99558]' : 'hover:border-slate-500'}`}
      >
        {equipped && (
          <span className="absolute left-1 top-1 rounded border border-[#665940] bg-[#201c17] px-1 text-[11px] font-bold text-[#d1ad67]">{localize("НАДЕТО")}</span>
        )}
        <div className="flex items-center justify-center h-9 mt-1">
          <ItemArtwork item={item} size={40} />
        </div>
        <div
          className="mt-1 min-h-[28px] max-h-[28px] overflow-hidden break-words text-center text-[11px] leading-[14px] font-medium text-slate-100"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={localize(item.name)}
        >
          {localize(item.name)}
        </div>
        <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
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
      onClick={() => setSelectedItem(item)}
      className="w-full rounded-xl border border-slate-800 bg-[#0a0f1d] p-2.5 flex min-h-[60px] items-center gap-3 text-left active:scale-[0.99]"
    >
      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
        <ItemArtwork item={item} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-100 truncate">{localize(item.name)}</span>
          <span className={`text-[11px] font-bold ${RARITY_COLORS[item.rarity].text}`}>{localize(RARITY_COLORS[item.rarity].label)}</span>
        </div>
        <div className="text-[11px] text-cyan-300 mt-0.5">{localize(getResourceUse(item))}</div>
      </div>
      <span className="text-sm font-mono font-bold text-slate-200">×{localize(item.stackCount || 1)}</span>
    </button>
  );

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[.15em] text-[#918c82]">{localize("Личный арсенал")}</div>
            <h1 className="section-title text-lg">{localize("Инвентарь")}</h1>
            <div className="text-[11px] text-slate-500 mt-0.5">{localize("Сравнение откроется при выборе предмета")}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">{localize("Сила снаряжения")}</div>
            <div className="text-sm font-mono font-bold text-amber-300">
              {localize(Math.round(combatStats.attack * 2 + combatStats.defense * 1.5 + combatStats.magicAttack))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-1.5">
          <div className="space-y-2">
            {(['helmet','weapon','gloves','pants','boots','cloak','pickaxe','alchemyTool'] as ItemType[]).map(type => {
              const item = player.equipped[type];
              return (
                <button key={type} onClick={() => item && setSelectedItem(item)}
                  className={`w-full min-h-[52px] rounded-lg border px-1.5 flex items-center gap-1.5 text-left ${item ? `${RARITY_COLORS[item.rarity].border} ${RARITY_COLORS[item.rarity].bg} ring-1 ring-[#b99558]/20` : 'border-slate-800 bg-slate-950/60'}`}>
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {item ? <ItemArtwork item={item} size={24} /> : <ItemTypeIcon type={type} className="text-slate-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] uppercase text-slate-500">{localize(TYPE_LABELS[type])}</div>
                    <div className="max-h-[28px] overflow-hidden break-words text-[11px] leading-[14px] text-slate-200" title={localize(item?.name || 'Пусто')}>{localize(item?.name || 'Пусто')}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative flex flex-col items-center">
            <div className="h-[132px] w-[68px] overflow-hidden rounded-xl border border-[#665940] bg-slate-950">
              <img src={(player.classId && CLASSES[player.classId]?.image) || ASSETS.heroHunter} alt={player.name} className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="absolute bottom-1 max-w-[70px] truncate rounded border border-[#665940] bg-black/75 px-1.5 py-1 text-[11px] font-bold text-[#d1ad67]">
              {player.name}
            </div>
          </div>

          <div className="space-y-2">
            {(['amulet','offhand','armor','ring','belt','artifact'] as ItemType[]).map(type => {
              const item = player.equipped[type];
              return (
                <button key={type} onClick={() => item && setSelectedItem(item)}
                  className={`w-full min-h-[52px] rounded-lg border px-1.5 flex items-center gap-1.5 text-left ${item ? `${RARITY_COLORS[item.rarity].border} ${RARITY_COLORS[item.rarity].bg} ring-1 ring-[#b99558]/20` : 'border-slate-800 bg-slate-950/60'}`}>
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {item ? <ItemArtwork item={item} size={24} /> : <ItemTypeIcon type={type} className="text-slate-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] uppercase text-slate-500">{localize(TYPE_LABELS[type])}</div>
                    <div className="max-h-[28px] overflow-hidden break-words text-[11px] leading-[14px] text-slate-200" title={localize(item?.name || 'Пусто')}>{localize(item?.name || 'Пусто')}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </BestiaryPanel>
      <OrnamentDivider />

      <div className="flex items-center justify-between">
        <div>
          <span className="font-cinzel text-sm font-bold text-slate-200">{localize("Сумка")}</span>
          <span className="ml-1.5 text-xs font-mono text-[#d1ad67]">
            {localize(player.inventory.length)}/{localize(player.maxInventorySlots)}
          </span>
        </div>
        <button
          onClick={handleInventoryExpansion}
          disabled={premium.loading || premiumBusy}
          title={localize(premium.active ? `Расширить сумку на 5 слотов за ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} золота` : 'Подключить Premium и расширить инвентарь')}
          className="min-h-11 rounded-lg border border-[#665940] bg-[#201c17] px-2 text-[11px] text-[#d1ad67] flex items-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
        >
          <RpgIcon kind="crown" size={15} />
          {localize(premiumBusy ? 'Открываю…' : premium.active ? `+5 слотов · ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} золота` : '+5 слотов · Только Premium')}
        </button>
      </div>
      {premium.active && <p className="-mt-1 text-[11px] text-slate-400">{localize("Расширение стоит ")}{localize((player.maxInventorySlots * 60).toLocaleString(intlLocale()))}{localize(" золота. У вас: ")}{localize(player.gold.toLocaleString(intlLocale()))}{localize(". Купленные слоты остаются после окончания Premium.")}</p>}
      {premiumFeedback && (
        <div className="-mt-1 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px] leading-4 text-amber-200/80">
          {localize(premiumFeedback)}
        </div>
      )}
      {!premium.active && !premium.loading && (
        <div className="-mt-1 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px] leading-4 text-amber-200/80">{localize("Расширение сумки доступно только с Premium. Базовые ")}{localize(player.maxInventorySlots)}{localize(" слотов остаются доступны всегда.")}</div>
      )}

      {!premium.active && <BulkInventoryActions />}

      <CodexTabs tabs={[
        { id: 'equipment', label: `Экипировка · ${EQUIPMENT_TYPES.filter(type => player.inventory.some(item => item.type === type)).length}` },
        { id: 'potions', label: `Зелья · ${potions.length}` },
        { id: 'resources', label: `Ресурсы · ${groupedResources.length}` },
      ]} active={tab} onChange={id => setTab(id as InventoryTab)} />

      {tab === 'equipment' && (
        equipment.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">{localize(equipment.map(renderItemCard))}</div>
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
                onClick={() => setSelectedItem(item)}
                className="w-full rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <ItemArtwork item={item} size={40} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 truncate">{localize(item.name)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{localize(item.description)}</div>
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
          <RpgButton variant="secondary" icon="forge" onClick={onNavigateToCrafting} className="w-full justify-start text-left text-xs text-[#d1ad67]">{localize("Открыть мастерскую снаряжения · рецепты и ресурсы")}</RpgButton>

          {groupedResources.length > 0 ? (
            <div className="space-y-1.5">{localize(groupedResources.map(renderResource))}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">{localize("Ресурсов пока нет.")}</div>
          )}
        </div>
      )}

      {currentSelected && (
        <div
          className="bottom-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center"
          onClick={() => setSelectedItem(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-item-title"
            className={`dialog-frame max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-3.5 pb-safe sm:rounded-2xl ${RARITY_COLORS[currentSelected.rarity].border}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <ItemArtwork item={currentSelected} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 id="selected-item-title" className="font-cinzel text-sm font-bold text-slate-100 truncate">
                      {localize(currentSelected.name)}
                    </h3>
                    <span className="text-amber-300 text-xs font-mono">+{localize(currentSelected.upgradeLevel)}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {localize(TYPE_LABELS[currentSelected.type])}{localize(" · Ур. ")}{localize(currentSelected.level)} · {localize(RARITY_COLORS[currentSelected.rarity].label)}
                  </div>
                  {currentSelected.serverOwned && <div className="text-[11px] text-emerald-300 mt-0.5">{localize("✓ Серверный предмет")}{localize(currentSelected.boundToClan ? ' · привязан к клану' : '')}</div>}
                  {(currentSelected.armorClass || currentSelected.weaponClass) && <div className="text-[11px] text-cyan-300 mt-0.5">
                    {localize(({heavy:'Тяжёлая броня',medium:'Средняя броня',light:'Лёгкая броня',twoHanded:'Двуручное оружие',dagger:'Кинжал',staff:'Посох',shield:'Щит',bow:'Лук'} as Record<string,string>)[currentSelected.armorClass || currentSelected.weaponClass || ''])}
                  </div>}
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} aria-label={localize("Закрыть описание предмета")} className="rpg-icon-button">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            {selectedIsEquipment ? (
              <div className="mt-3 space-y-2">
                <ClassGearBonus item={currentSelected} characterClass={player.classId} />
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                    <span className="text-slate-500">{localize("СРАВНЕНИЕ С ТЕКУЩИМ")}</span>
                    <span className={scoreDelta > 0 ? 'text-emerald-300 font-bold' : scoreDelta < 0 ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                      {localize(currentEquipped ? `Сила ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}` : 'Слот пуст')}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2 mb-2">
                    <div className="rounded-lg bg-slate-900 p-2">
                      <div className="text-[11px] text-slate-500 mb-1">{localize("СЕЙЧАС")}</div>
                      <div className="text-[11px] font-bold text-slate-200 truncate">{localize(currentEquipped?.name || 'Слот пуст')}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{localize(currentEquipped ? `Ур.${currentEquipped.level} +${currentEquipped.upgradeLevel}` : '—')}</div>
                    </div>
                    <div className="rounded-lg bg-cyan-950/20 border border-cyan-500/20 p-2">
                      <div className="text-[11px] text-cyan-400 mb-1">{localize("ВЫБРАНО")}</div>
                      <div className="text-[11px] font-bold text-slate-100 truncate">{localize(currentSelected.name)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{localize("Ур.")}{localize(currentSelected.level)} +{localize(currentSelected.upgradeLevel)}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {statKeys.map(stat => {
                      const selectedValue = selectedStats[stat] || 0;
                      const currentValue = currentStats[stat] || 0;
                      const delta = selectedValue - currentValue;
                      return (
                        <div key={stat} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px]">
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

                <p className="text-[11px] text-slate-500">
                  {localize((currentSelected.type === 'pickaxe' || currentSelected.type === 'alchemyTool') ? currentSelected.description : 'Сравнение считает базовые и дополнительные характеристики. Заточка отображается отдельно и тоже влияет на боевую силу.')}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[11px] text-cyan-400 font-mono uppercase">{localize("Назначение")}</div>
                <div className="text-xs text-slate-200">
                  {localize(currentSelected.type === 'potion' ? currentSelected.description : getResourceUse(currentSelected))}
                </div>
                {Object.keys(getItemStats(currentSelected)).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    {Object.entries(getItemStats(currentSelected)).map(([stat, value]) => (
                      <div key={stat} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{localize(STAT_LABELS[stat] || stat)}</span>
                        <span className="text-emerald-300 font-mono">+{localize(formatStat(stat, value))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentSelected.stackCount && currentSelected.stackCount > 1 && (
                  <div className="text-[11px] text-slate-400">{localize("В стопке: ")}{localize(currentSelected.stackCount)}</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => toggleItemLock(currentSelected.id)}
                className="rpg-button rpg-button-secondary min-h-11 text-xs"
              >
                {localize(currentSelected.isLocked ? 'Разблокировать' : 'Защитить от продажи')}
              </button>
              {currentSelected.isEquipped ? (
                <button
                  onClick={() => {
                    unequipItem(currentSelected.type);
                    setSelectedItem(null);
                  }}
                  className="rpg-button rpg-button-secondary min-h-11 text-xs"
                >{localize("Снять")}</button>
              ) : selectedIsEquipment ? (
                <button
                  onClick={() => {
                    equipItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  disabled={currentSelected.level > player.level || currentSelected.type==='pickaxe' && player.miningLevel<(getPickaxeBonus(currentSelected)?.miningLevel||1) || currentSelected.type==='alchemyTool' && !getAlchemyToolBonus(currentSelected,player.alchemyLevel)}
                  className="rpg-button rpg-button-primary min-h-11 text-xs"
                >
                  {localize(currentSelected.level > player.level ? `Нужен уровень ${currentSelected.level}` : currentSelected.type==='pickaxe' && player.miningLevel<(getPickaxeBonus(currentSelected)?.miningLevel||1) ? 'Недостаточный уровень шахты' : currentSelected.type==='alchemyTool' && !getAlchemyToolBonus(currentSelected,player.alchemyLevel) ? 'Недостаточный уровень алхимии' : 'Экипировать')}
                </button>
              ) : (
                <button
                  disabled
                  className="rpg-button rpg-button-secondary min-h-11 text-xs"
                >{localize("Только ресурс")}</button>
              )}

              {selectedIsEquipment && onNavigateToBlacksmith && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    onNavigateToBlacksmith();
                  }}
                  className="rpg-button rpg-button-secondary min-h-11 border-[#59456e] text-[#b8a2cf]"
                >
                  <RpgIcon kind="forge" size={17} />{localize(" В кузницу")}</button>
              )}

              {!currentSelected.isLocked && ((selectedIsEquipment && !currentSelected.isEquipped) || Boolean(currentSelected.disassembleYield?.silver)) && (
                <button
                  onClick={() => {
                    disassembleItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="rpg-button rpg-button-secondary min-h-11 text-xs"
                >
                  <RpgIcon kind="skill" size={16} />
                  {localize(currentSelected.name === 'Сырой самоцвет'
                    ? `Огранить → ${getDisassemblePreview(currentSelected)}`
                    : `Разобрать → ${getDisassemblePreview(currentSelected)}`)}
                </button>
              )}

              {!currentSelected.isEquipped && !currentSelected.isLocked && (
                <button
                  onClick={() => {
                    sellItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="rpg-button rpg-button-secondary min-h-11 text-xs text-[#d1ad67]"
                >
                  <RpgIcon kind="gold" size={16} />{localize(" Продать за ")}{localize(currentSelected.sellPrice || 0)}{localize(" золота")}</button>
              )}
            </div>
          </section>
        </div>
      )}

      {premium.active && <BulkInventoryActions />}
      <div className="text-[11px] text-slate-600 text-center">{localize("Руда из шахты теперь расходуется на заточку: чем выше +, тем более редкая руда нужна.")}</div>
    </FolioPage>
  );
};
