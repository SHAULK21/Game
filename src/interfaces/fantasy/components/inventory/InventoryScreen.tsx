import { useInterface } from '../../../../context/InterfaceContext';
import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { STAT_LABELS } from '../../../../utils/statLabels';
import { getAlchemyToolBonus } from '../../../../utils/alchemy';
import { getPickaxeBonus } from '../../../../utils/mining';
import { ASCENSION_FRAGMENT_DESCRIPTION } from '../../../../data/ascension';
import { BulkInventoryActions } from './BulkInventoryActions';
import React, { useMemo, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { GameItem, ItemType, CharacterClassId } from '../../../../types/game';
import { RARITY_COLORS } from '../../data/gameData';
import { RpgIcon } from '../ui/RpgIcon';
import { InventoryArt } from './InventoryArt';
import { EquipmentManuscript } from './EquipmentManuscript';
import { ReferenceFrameParts } from '../ui/ReferencePart';
import { useDialog } from '../ui/useDialog';
import { InventoryClassBonus } from './InventoryClassBonus';
import { getEffectiveGearStats } from '../../../../utils/classEquipment';
import { CodexTabs, FolioPage, RpgButton } from '../ui/BestiaryUI';

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
  const { style } = useInterface();
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

  const dialogRef = useDialog(Boolean(selectedItem), () => setSelectedItem(null));

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
    const equipped = player.equipped[item.type]?.id === item.id;
    return <button type="button" key={item.id} onClick={() => setSelectedItem(item)}
      data-inventory-item={item.id} data-rarity={item.rarity} className={`inventory-bag-slot ${equipped ? 'is-equipped' : ''}`}
      aria-label={`${localize(item.name)} · ${localize(RARITY_COLORS[item.rarity].label)} · ${localize('Ур.')} ${item.level}${item.isLocked ? ` · ${localize('Защитить от продажи')}` : ''}`}
      title={localize(item.name)}>
      <ReferenceFrameParts id="equipment" />
      <InventoryArt item={item} size={42} />
      {style === 'fantasy-beta' && <span className="beta-item-name">{localize(item.name)}<small>{localize('Ур.')} {localize(item.level)}</small></span>}
      <span className="inventory-bag-quantity">{localize(item.stackCount || 1)}</span>
      {item.upgradeLevel>0 && <span className="inventory-bag-upgrade">+{item.upgradeLevel}</span>}
      {equipped && <span className="inventory-bag-state">{localize('НАДЕТО')}</span>}
      {item.isLocked && <span className="inventory-bag-state">{localize('Защитить от продажи')}</span>}
    </button>;
  };
  const renderBag = (items: GameItem[], emptyMessage: string) => <>
    <div className="inventory-bag-grid">
      {items.map(renderItemCard)}
      {Array.from({length:Math.max(0,12-items.length)},(_,index)=><span key={`empty-${index}`} className="inventory-bag-slot is-empty" aria-hidden="true"><ReferenceFrameParts id="equipment"/></span>)}
    </div>
    {!items.length && <p className="inventory-empty-message">{localize(emptyMessage)}</p>}
  </>;

  return (
    <FolioPage className="inventory-book">
      <section className="inventory-equipment-page" aria-label={localize('Экипировка')}>
        <div className="inventory-page-heading">
          <h1>{localize('Экипировка')}</h1>
          <div><span>{localize('Сила снаряжения')}</span><strong>{localize(Math.round(combatStats.attack * 2 + combatStats.defense * 1.5 + combatStats.magicAttack))}</strong></div>
        </div>
        <EquipmentManuscript player={player} labels={TYPE_LABELS} onSelect={setSelectedItem}/>
      </section>
      <section className="inventory-bag-page" aria-label={localize('Сумка')}>
      <div className="flex items-center justify-between">
        <div>
          <span className="inventory-bag-title">{localize("Сумка")}</span>
          <span className="ml-1.5 text-xs font-mono inventory-ink">
            {localize(player.inventory.length)}/{localize(player.maxInventorySlots)}
          </span>
        </div>
        <button
          onClick={handleInventoryExpansion}
          disabled={premium.loading || premiumBusy}
          title={localize(premium.active ? `Расширить сумку на 5 слотов за ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} золота` : 'Подключить Premium и расширить инвентарь')}
          className="rpg-button rpg-button-danger inventory-expand min-h-11 px-2 text-[11px] disabled:opacity-60 disabled:cursor-wait"
        >
          <RpgIcon kind="crown" size={15} />
          {localize(premiumBusy ? 'Открываю…' : premium.active ? `+5 слотов · ${(player.maxInventorySlots * 60).toLocaleString(intlLocale())} золота` : '+5 слотов · Только Premium')}
        </button>
      </div>
      {premium.active && <p className="-mt-1 text-[11px] inventory-ink">{localize("Расширение стоит ")}{localize((player.maxInventorySlots * 60).toLocaleString(intlLocale()))}{localize(" золота. У вас: ")}{localize(player.gold.toLocaleString(intlLocale()))}{localize(". Купленные слоты остаются после окончания Premium.")}</p>}
      {premiumFeedback && (
        <div className="inventory-bag-note">
          {localize(premiumFeedback)}
        </div>
      )}
      {!premium.active && !premium.loading && (
        <div className="inventory-bag-note">{localize("Расширение сумки доступно только с Premium. Базовые ")}{localize(player.maxInventorySlots)}{localize(" слотов остаются доступны всегда.")}</div>
      )}


      <CodexTabs tabs={[
        { id: 'equipment', label: `Экипировка · ${equipment.length}` },
        { id: 'potions', label: `Зелья · ${potions.length}` },
        { id: 'resources', label: `Ресурсы · ${groupedResources.length}` },
      ]} active={tab} onChange={id => setTab(id as InventoryTab)} />

      {tab === 'equipment' && renderBag(equipment, 'Здесь появится добытая экипировка.')}
      {tab === 'potions' && renderBag(potions, 'Зелий нет.')}
      {tab === 'resources' && <>
        {renderBag(groupedResources, 'Ресурсов пока нет.')}
        <RpgButton variant="secondary" icon="forge" onClick={onNavigateToCrafting} className="w-full justify-start text-left text-xs">{localize('Открыть мастерскую снаряжения · рецепты и ресурсы')}</RpgButton>
      </>}
      <p className="inventory-bag-hint">{localize('Сравнение откроется при выборе предмета')}</p>
      </section>

      {currentSelected && (
        <div
          className="bottom-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center"
          onClick={() => setSelectedItem(null)}
        >
          <section
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-item-title"
            className="inventory-item-sheet max-h-[88dvh] w-full max-w-lg overflow-y-auto p-3.5 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="inventory-detail-art w-14 h-14 shrink-0 flex items-center justify-center">
                  <InventoryArt item={currentSelected} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 id="selected-item-title" className="inventory-detail-title">
                      {localize(currentSelected.name)}
                    </h3>
                    <span className="inventory-ink text-xs font-mono">+{localize(currentSelected.upgradeLevel)}</span>
                  </div>
                  <div className="text-[11px] inventory-ink mt-0.5">
                    {localize(TYPE_LABELS[currentSelected.type])}{localize(" · Ур. ")}{localize(currentSelected.level)} · {localize(RARITY_COLORS[currentSelected.rarity].label)}
                  </div>
                  {currentSelected.serverOwned && <div className="text-[11px] inventory-positive mt-0.5">{localize("✓ Серверный предмет")}{localize(currentSelected.boundToClan ? ' · привязан к клану' : '')}</div>}
                  {(currentSelected.armorClass || currentSelected.weaponClass) && <div className="text-[11px] inventory-ink mt-0.5">
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
                <InventoryClassBonus item={currentSelected} characterClass={player.classId} />
                <div className="inventory-paper-inset p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                    <span className="inventory-ink">{localize("СРАВНЕНИЕ С ТЕКУЩИМ")}</span>
                    <span className={scoreDelta > 0 ? 'inventory-positive font-bold' : scoreDelta < 0 ? 'inventory-negative font-bold' : 'inventory-ink'}>
                      {localize(currentEquipped ? `Сила ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}` : 'Слот пуст')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="inventory-paper-inset p-2">
                      <div className="text-[11px] inventory-ink mb-1">{localize("СЕЙЧАС")}</div>
                      <div className="text-[11px] font-bold inventory-ink truncate">{localize(currentEquipped?.name || 'Слот пуст')}</div>
                      <div className="text-[11px] inventory-ink mt-0.5">{localize(currentEquipped ? `Ур.${currentEquipped.level} +${currentEquipped.upgradeLevel}` : '—')}</div>
                    </div>
                    <div className="inventory-paper-inset is-selected p-2">
                      <div className="text-[11px] inventory-ink mb-1">{localize("ВЫБРАНО")}</div>
                      <div className="text-[11px] font-bold inventory-ink truncate">{localize(currentSelected.name)}</div>
                      <div className="text-[11px] inventory-ink mt-0.5">{localize("Ур.")}{localize(currentSelected.level)} +{localize(currentSelected.upgradeLevel)}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {statKeys.map(stat => {
                      const selectedValue = selectedStats[stat] || 0;
                      const currentValue = currentStats[stat] || 0;
                      const delta = selectedValue - currentValue;
                      return (
                        <div key={stat} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center text-[11px]">
                          <span className="inventory-ink">{localize(STAT_LABELS[stat] || stat)}</span>
                          <span className="font-mono inventory-ink">{localize(formatStat(stat, currentValue))}</span>
                          <span className={`font-mono font-bold min-w-[68px] text-right ${delta > 0 ? 'inventory-positive' : delta < 0 ? 'inventory-negative' : 'inventory-ink'}`}>
                            {localize(delta > 0 ? '+' : '')}{localize(formatStat(stat, delta))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] inventory-ink">
                  {localize((currentSelected.type === 'pickaxe' || currentSelected.type === 'alchemyTool') ? currentSelected.description : 'Сравнение считает базовые и дополнительные характеристики. Заточка отображается отдельно и тоже влияет на боевую силу.')}
                </p>
              </div>
            ) : (
              <div className="inventory-paper-inset mt-3 p-3 space-y-2">
                <div className="text-[11px] inventory-ink font-mono uppercase">{localize("Назначение")}</div>
                <div className="text-xs inventory-ink">
                  {localize(currentSelected.type === 'potion' ? currentSelected.description : getResourceUse(currentSelected))}
                </div>
                {Object.keys(getItemStats(currentSelected)).length > 0 && (
                  <div className="space-y-1 pt-1 border-t inventory-rule">
                    {Object.entries(getItemStats(currentSelected)).map(([stat, value]) => (
                      <div key={stat} className="flex items-center justify-between text-[11px]">
                        <span className="inventory-ink">{localize(STAT_LABELS[stat] || stat)}</span>
                        <span className="inventory-positive font-mono">+{localize(formatStat(stat, value))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentSelected.stackCount && currentSelected.stackCount > 1 && (
                  <div className="text-[11px] inventory-ink">{localize("В стопке: ")}{localize(currentSelected.stackCount)}</div>
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
                  className="rpg-button rpg-button-secondary min-h-11 "
                >
                  <RpgIcon kind="forge" size={17} />{localize(" В кузницу")}</button>
              )}

              {!currentSelected.isLocked && !currentSelected.isEquipped && (selectedIsEquipment || Boolean(currentSelected.disassembleYield?.silver)) && (
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
                  className="rpg-button rpg-button-secondary min-h-11 text-xs inventory-ink"
                >
                  <RpgIcon kind="gold" size={16} />{localize(" Продать за ")}{localize(currentSelected.sellPrice || 0)}{localize(" золота")}</button>
              )}
            </div>
          </section>
        </div>
      )}

      <BulkInventoryActions />
      <div className="text-[11px] inventory-ink text-center">{localize("Руда из шахты теперь расходуется на заточку: чем выше +, тем более редкая руда нужна.")}</div>
    </FolioPage>
  );
};
