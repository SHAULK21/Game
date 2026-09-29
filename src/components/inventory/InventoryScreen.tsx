import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { GameItem, ItemType } from '../../types/game';
import { RARITY_COLORS, CLASSES, ASSETS, BASIC_CRAFT_RECIPES } from '../../data/gameData';
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
  Swords
} from 'lucide-react';
import { RpgIcon } from '../ui/RpgIcon';
import { ItemArtwork } from '../ui/ItemArtwork';

interface InventoryScreenProps {
  onNavigateToBlacksmith?: () => void;
}

type InventoryTab = 'equipment' | 'potions' | 'resources';

const EQUIPMENT_TYPES: ItemType[] = [
  'weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves',
  'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'
];

const TYPE_LABELS: Partial<Record<ItemType, string>> = {
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

const STAT_LABELS: Record<string, string> = {
  attack: 'Атака',
  magicAttack: 'Магическая атака',
  defense: 'Защита',
  magicDefense: 'Магическая защита',
  maxHp: 'Макс. HP',
  maxMp: 'Макс. MP',
  speed: 'Скорость',
  accuracy: 'Точность',
  evasion: 'Уклонение',
  critChance: 'Шанс крита',
  critDamage: 'Сила крита',
  vampirism: 'Вампиризм',
  hpRegen: 'Реген. HP',
  mpRegen: 'Реген. MP',
  armorPenetration: 'Пробитие брони',
  physicalResistance: 'Сопр. физике',
  magicResistance: 'Сопр. магии',
  fireResistance: 'Сопр. огню',
  iceResistance: 'Сопр. льду',
  lightningResistance: 'Сопр. молнии',
  poisonResistance: 'Сопр. яду',
  darkResistance: 'Сопр. тьме',
  holyResistance: 'Сопр. свету'
};

const PERCENT_STATS = new Set([
  'critChance', 'critDamage', 'vampirism', 'accuracy', 'evasion',
  'physicalResistance', 'magicResistance', 'fireResistance',
  'iceResistance', 'lightningResistance', 'poisonResistance',
  'darkResistance', 'holyResistance', 'attackPercent', 'defensePercent'
]);

const getItemStats = (item?: GameItem | null): Record<string, number> => {
  if (!item) return {};
  const upMult = 1 + (item.upgradeLevel || 0) * 0.12;
  const stats: Record<string, number> = {};
  Object.entries(item.stats || {}).forEach(([key, value]) => {
    stats[key] = ['attack', 'magicAttack', 'defense', 'magicDefense'].includes(key)
      ? Math.round(value * upMult)
      : value;
  });
  if (item.baseAttack && stats.attack === undefined) stats.attack = Math.round(item.baseAttack * upMult);
  if (item.baseDefense && stats.defense === undefined) stats.defense = Math.round(item.baseDefense * upMult);
  if (item.baseMagicDef && stats.magicDefense === undefined) stats.magicDefense = Math.round(item.baseMagicDef * upMult);
  return stats;
};

const getItemScore = (item: GameItem): number => {
  const stats = getItemStats(item);
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

const ItemTypeIcon: React.FC<{ type: ItemType; className?: string }> = ({ type, className = 'text-slate-500' }) => (
  <RpgIcon kind={type} size={22} className={className} />
);

const getResourceUse = (item: GameItem) => {
  if (item.type === 'ore') return 'Кузница · заточка экипировки';
  if (item.name === 'Сырой самоцвет') return 'Огранка · переработка в серебро';
  if (item.name === 'Лечебная трава' || item.name === 'Чистая вода' || item.name === 'Лунная пыльца' || item.name === 'Ядовитая железа' || item.name === 'Острый клык' || item.name === 'Огненный цветок' || item.name === 'Горный корень' || item.name === 'Магическая эссенция') {
    return 'Алхимия · создание зелий';
  }
  return 'Ремесло и специальные рецепты';
};

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onNavigateToBlacksmith }) => {
  const {
    player,
    combatStats,
    equipItem,
    unequipItem,
    sellItem,
    disassembleItem,
    expandInventory,
    craftBasicItem
  } = useGame();

  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [tab, setTab] = useState<InventoryTab>('equipment');
  const [craftFeedback, setCraftFeedback] = useState<string | null>(null);

  if (!player) return null;

  const currentSelected = selectedItem
    ? player.inventory.find(i => i.id === selectedItem.id) || Object.values(player.equipped).find(i => i?.id === selectedItem.id) || selectedItem
    : null;

  const equipment = useMemo(
    () => player.inventory
      .filter(item => EQUIPMENT_TYPES.includes(item.type))
      .sort((a, b) => {
        const aCurrent = player.equipped[a.type]?.id === a.id ? 1 : 0;
        const bCurrent = player.equipped[b.type]?.id === b.id ? 1 : 0;
        return bCurrent - aCurrent || getItemScore(b) - getItemScore(a);
      }),
    [player.inventory, player.equipped]
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
  const selectedStats = getItemStats(currentSelected);
  const currentStats = getItemStats(currentEquipped);
  const statKeys = [...new Set([...Object.keys(currentStats), ...Object.keys(selectedStats)])];

  const selectedScore = currentSelected && selectedIsEquipment ? getItemScore(currentSelected) : 0;
  const currentScore = currentEquipped ? getItemScore(currentEquipped) : 0;
  const scoreDelta = selectedIsEquipment ? selectedScore - currentScore : 0;

  const renderItemCard = (item: GameItem) => {
    const rarityStyle = RARITY_COLORS[item.rarity];
    const equipped = player.equipped[item.type]?.id === item.id;

    return (
      <button
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className={`relative text-left p-2.5 rounded-xl border min-h-[88px] transition-all active:scale-[0.98] ${rarityStyle.border} ${rarityStyle.bg} ${equipped ? 'ring-1 ring-cyan-400/70' : 'hover:border-slate-500'}`}
      >
        {equipped && (
          <span className="absolute top-1 left-1 text-[8px] font-bold px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            НАДЕТО
          </span>
        )}
        <div className="flex items-center justify-center h-9 mt-1">
          <ItemArtwork item={item} size={40} />
        </div>
        <div
          className="mt-1 text-[9px] leading-[11px] text-slate-100 font-medium text-center break-words overflow-hidden min-h-[22px] max-h-[22px]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={item.name}
        >
          {item.name}
        </div>
        <div className="text-[9px] text-slate-400 flex items-center justify-between gap-1">
          <span>Ур.{item.level}</span>
          <span className="text-amber-300 font-bold">{item.upgradeLevel > 0 ? `+${item.upgradeLevel}` : '+0'}</span>
        </div>
      </button>
    );
  };

  const renderResource = (item: GameItem) => (
    <button
      key={item.id}
      onClick={() => setSelectedItem(item)}
      className="w-full p-2.5 rounded-xl border border-slate-800 bg-[#0a0f1d] flex items-center gap-3 text-left active:scale-[0.99]"
    >
      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
        <ItemArtwork item={item} size={40} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-100 truncate">{item.name}</span>
          <span className={`text-[9px] font-bold ${RARITY_COLORS[item.rarity].text}`}>{RARITY_COLORS[item.rarity].label}</span>
        </div>
        <div className="text-[10px] text-cyan-300 mt-0.5">{getResourceUse(item)}</div>
      </div>
      <span className="text-sm font-mono font-bold text-slate-200">×{item.stackCount || 1}</span>
    </button>
  );

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#0b101d] to-[#07090e] p-3.5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-cinzel text-sm font-bold text-cyan-300">Снаряжение</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Сравнение показывает разницу до экипировки</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">Боевая сила</div>
            <div className="text-sm font-mono font-bold text-amber-300">
              {Math.round(combatStats.attack * 2 + combatStats.defense * 1.5 + combatStats.magicAttack)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_92px_1fr] gap-2 items-center">
          <div className="space-y-2">
            {(['helmet','weapon','gloves','pants','boots','cloak'] as ItemType[]).map(type => {
              const item = player.equipped[type];
              return (
                <button key={type} onClick={() => item && setSelectedItem(item)}
                  className={`w-full min-h-[48px] rounded-xl border px-2 flex items-center gap-2 text-left ${item ? `${RARITY_COLORS[item.rarity].border} ${RARITY_COLORS[item.rarity].bg} ring-1 ring-cyan-400/20` : 'border-slate-800 bg-slate-950/60'}`}>
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {item ? <ItemArtwork item={item} size={28} /> : <ItemTypeIcon type={type} className="text-slate-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] text-slate-500 uppercase truncate">{TYPE_LABELS[type]}</div>
                    <div className="text-[9px] leading-[10px] text-slate-200 break-words overflow-hidden max-h-[20px]" title={item?.name || 'Пусто'}>{item?.name || 'Пусто'}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative flex flex-col items-center">
            <div className="w-[88px] h-[150px] rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-slate-950 shadow-lg shadow-cyan-950/50">
              <img src={(player.classId && CLASSES[player.classId]?.image) || ASSETS.heroHunter} alt={player.name} className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="absolute bottom-1 px-2 py-1 rounded bg-black/75 border border-cyan-500/30 text-[9px] font-bold text-cyan-200">
              {player.name}
            </div>
          </div>

          <div className="space-y-2">
            {(['amulet','offhand','armor','ring','belt','artifact'] as ItemType[]).map(type => {
              const item = player.equipped[type];
              return (
                <button key={type} onClick={() => item && setSelectedItem(item)}
                  className={`w-full min-h-[48px] rounded-xl border px-2 flex items-center gap-2 text-left ${item ? `${RARITY_COLORS[item.rarity].border} ${RARITY_COLORS[item.rarity].bg} ring-1 ring-cyan-400/20` : 'border-slate-800 bg-slate-950/60'}`}>
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    {item ? <ItemArtwork item={item} size={28} /> : <ItemTypeIcon type={type} className="text-slate-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] text-slate-500 uppercase truncate">{TYPE_LABELS[type]}</div>
                    <div className="text-[9px] leading-[10px] text-slate-200 break-words overflow-hidden max-h-[20px]" title={item?.name || 'Пусто'}>{item?.name || 'Пусто'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="font-cinzel text-xs font-bold text-slate-200">Сумка</span>
          <span className="ml-1.5 text-xs font-mono text-cyan-400">
            {player.inventory.length}/{player.maxInventorySlots}
          </span>
        </div>
        <button
          onClick={expandInventory}
          className="text-[10px] px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          +5 слотов
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {([
          ['equipment', 'Экипировка', EQUIPMENT_TYPES.filter(type => player.inventory.some(item => item.type === type)).length],
          ['potions', 'Зелья', potions.length],
          ['resources', 'Ресурсы', groupedResources.length]
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`py-2 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 ${tab === id ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
          >
            {id === 'equipment' ? <Shield className="w-3.5 h-3.5" /> : id === 'potions' ? <FlaskConical className="w-3.5 h-3.5" /> : <Pickaxe className="w-3.5 h-3.5" />}
            {label} <span className="opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {tab === 'equipment' && (
        equipment.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">{equipment.map(renderItemCard)}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">
            Здесь появится добытая экипировка.
          </div>
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
                  <div className="text-xs font-bold text-slate-100 truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.description}</div>
                </div>
                <span className="font-mono text-sm text-emerald-300">×{item.stackCount || 1}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">
            Зелий нет.
          </div>
        )
      )}

      {tab === 'resources' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/25 bg-amber-950/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs font-bold text-amber-300">Переработка трофеев</div>
                <div className="text-[10px] text-slate-500">Обычный лут превращается в расходники, базовую экипировку или серебро.</div>
              </div>
              <Hammer className="w-4 h-4 text-amber-400" />
            </div>

            {craftFeedback && (
              <div className="mb-2 rounded-lg border border-slate-700 bg-slate-950/70 p-2 text-[10px] text-slate-300">
                {craftFeedback}
              </div>
            )}

            <div className="space-y-2">
              {BASIC_CRAFT_RECIPES.map(recipe => {
                const canCraft = recipe.ingredients.every(ingredient => {
                  const have = player.inventory.reduce(
                    (sum, item) => sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0),
                    0
                  );
                  return have >= ingredient.count;
                });
                return (
                  <div key={recipe.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl shrink-0">{recipe.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-100">{recipe.name}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{recipe.description}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {recipe.ingredients.map(ingredient => {
                            const have = player.inventory.reduce(
                              (sum, item) => sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0),
                              0
                            );
                            return (
                              <span key={ingredient.name} className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                have >= ingredient.count
                                  ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                                  : 'border-rose-500/30 bg-rose-950/30 text-rose-300'
                              }`}>
                                {ingredient.name} {have}/{ingredient.count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const result = craftBasicItem(recipe.id);
                          setCraftFeedback(result.message);
                        }}
                        disabled={!canCraft}
                        className="shrink-0 px-2 py-1.5 rounded-lg bg-amber-600 disabled:opacity-35 disabled:cursor-not-allowed text-[10px] font-bold text-slate-950 active:scale-95"
                      >
                        Создать
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {groupedResources.length > 0 ? (
            <div className="space-y-1.5">{groupedResources.map(renderResource)}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 p-7 text-center text-xs text-slate-500">
              Ресурсов пока нет.
            </div>
          )}
        </div>
      )}

      {currentSelected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className={`w-full max-w-lg rounded-2xl border p-3.5 bg-[#080c15] shadow-2xl ${RARITY_COLORS[currentSelected.rarity].border}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <ItemArtwork item={currentSelected} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-cinzel text-sm font-bold text-slate-100 truncate">
                      {currentSelected.name}
                    </h3>
                    <span className="text-amber-300 text-xs font-mono">+{currentSelected.upgradeLevel}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {TYPE_LABELS[currentSelected.type]} · Ур. {currentSelected.level} · {RARITY_COLORS[currentSelected.rarity].label}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1 text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedIsEquipment ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="text-slate-500">СРАВНЕНИЕ С ТЕКУЩИМ</span>
                    <span className={scoreDelta > 0 ? 'text-emerald-300 font-bold' : scoreDelta < 0 ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                      {currentEquipped ? `Сила ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}` : 'Слот пуст'}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2 mb-2">
                    <div className="rounded-lg bg-slate-900 p-2">
                      <div className="text-[9px] text-slate-500 mb-1">СЕЙЧАС</div>
                      <div className="text-[10px] font-bold text-slate-200 truncate">{currentEquipped?.name || 'Слот пуст'}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{currentEquipped ? `Ур.${currentEquipped.level} +${currentEquipped.upgradeLevel}` : '—'}</div>
                    </div>
                    <div className="rounded-lg bg-cyan-950/20 border border-cyan-500/20 p-2">
                      <div className="text-[9px] text-cyan-400 mb-1">ВЫБРАНО</div>
                      <div className="text-[10px] font-bold text-slate-100 truncate">{currentSelected.name}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Ур.{currentSelected.level} +{currentSelected.upgradeLevel}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {statKeys.map(stat => {
                      const selectedValue = selectedStats[stat] || 0;
                      const currentValue = currentStats[stat] || 0;
                      const delta = selectedValue - currentValue;
                      return (
                        <div key={stat} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[10px]">
                          <span className="text-slate-400">{STAT_LABELS[stat] || stat}</span>
                          <span className="font-mono text-slate-500">{formatStat(stat, currentValue)}</span>
                          <span className={`font-mono font-bold min-w-[68px] text-right ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                            {delta > 0 ? '+' : ''}{formatStat(stat, delta)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Сравнение считает базовые и дополнительные характеристики. Заточка отображается отдельно и тоже влияет на боевую силу.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="text-[10px] text-cyan-400 font-mono uppercase">Назначение</div>
                <div className="text-xs text-slate-200">
                  {currentSelected.type === 'potion' ? currentSelected.description : getResourceUse(currentSelected)}
                </div>
                {Object.keys(getItemStats(currentSelected)).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    {Object.entries(getItemStats(currentSelected)).map(([stat, value]) => (
                      <div key={stat} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">{STAT_LABELS[stat] || stat}</span>
                        <span className="text-emerald-300 font-mono">+{formatStat(stat, value)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {currentSelected.stackCount && currentSelected.stackCount > 1 && (
                  <div className="text-[10px] text-slate-400">В стопке: {currentSelected.stackCount}</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              {currentSelected.isEquipped ? (
                <button
                  onClick={() => {
                    unequipItem(currentSelected.type);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Снять
                </button>
              ) : selectedIsEquipment ? (
                <button
                  onClick={() => {
                    equipItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  disabled={currentSelected.level > player.level}
                  className="py-2.5 rounded-xl bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {currentSelected.level > player.level ? `Нужен уровень ${currentSelected.level}` : 'Экипировать'}
                </button>
              ) : (
                <button
                  disabled
                  className="py-2.5 rounded-xl bg-slate-900 text-slate-600 text-xs font-bold"
                >
                  Только ресурс
                </button>
              )}

              {selectedIsEquipment && onNavigateToBlacksmith && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    onNavigateToBlacksmith();
                  }}
                  className="py-2.5 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Hammer className="w-4 h-4 text-purple-400" /> В кузницу
                </button>
              )}

              {((selectedIsEquipment && !currentSelected.isEquipped) || Boolean(currentSelected.disassembleYield?.silver)) && (
                <button
                  onClick={() => {
                    disassembleItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  {currentSelected.name === 'Сырой самоцвет' ? 'Огранить → серебро' : 'Разобрать'}
                </button>
              )}

              {!currentSelected.isEquipped && (
                <button
                  onClick={() => {
                    sellItem(currentSelected);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-4 h-4" /> Продать за {currentSelected.sellPrice || 0} 🪙
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-[9px] text-slate-600 text-center">
        Руда из шахты теперь расходуется на заточку: чем выше +, тем более редкая руда нужна.
      </div>
    </div>
  );
};
