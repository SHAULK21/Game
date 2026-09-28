import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { GameItem, ItemType, ItemRarity } from '../../types/game';
import { RARITY_COLORS } from '../../data/gameData';
import { ASSETS } from '../../data/gameData';
import { 
  Shield, 
  Sparkles, 
  Trash2, 
  Coins, 
  Hammer, 
  Plus, 
  Filter,
  CheckCircle,
  X
} from 'lucide-react';

interface InventoryScreenProps {
  onNavigateToBlacksmith?: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onNavigateToBlacksmith }) => {
  const {
    player,
    combatStats,
    equipItem,
    unequipItem,
    sellItem,
    disassembleItem,
    expandInventory
  } = useGame();

  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');

  if (!player) return null;

  // Filter items
  const filteredItems = player.inventory.filter(item => {
    if (filterType !== 'all') {
      if (filterType === 'equipment' && !['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'ring', 'amulet', 'belt', 'cloak'].includes(item.type)) {
        return false;
      }
      if (filterType === 'potions' && item.type !== 'potion') return false;
      if (filterType === 'materials' && item.type !== 'material' && item.type !== 'ore') return false;
    }
    if (filterRarity !== 'all' && item.rarity !== filterRarity) {
      return false;
    }
    return true;
  });

  const slotsOrder: { type: ItemType; label: string; icon: string }[] = [
    { type: 'weapon', label: 'Оружие', icon: '🗡️' },
    { type: 'offhand', label: 'Щит/Второе', icon: '🛡️' },
    { type: 'helmet', label: 'Шлем', icon: '🪖' },
    { type: 'armor', label: 'Доспех', icon: '🦺' },
    { type: 'pants', label: 'Штаны', icon: '👖' },
    { type: 'gloves', label: 'Перчатки', icon: '🧤' },
    { type: 'boots', label: 'Сапоги', icon: '👢' },
    { type: 'amulet', label: 'Амулет', icon: '📿' },
    { type: 'ring', label: 'Кольцо', icon: '💍' },
    { type: 'belt', label: 'Пояс', icon: '🥋' },
    { type: 'cloak', label: 'Плащ', icon: '🧥' },
    { type: 'artifact', label: 'Реликвия', icon: '🔮' },
  ];

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* EQUIPMENT PAPER-DOLL SECTION */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#0b101d] to-[#07090e] p-3.5 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
          <span className="font-cinzel text-xs font-bold text-cyan-300 uppercase tracking-wider">
            Экипировка героя
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Боевая мощь: <span className="text-amber-400 font-bold">{Math.round(combatStats.attack * 2 + combatStats.defense * 1.5)}</span>
          </span>
        </div>

        {/* Paper-doll Grid */}
        <div className="grid grid-cols-4 gap-2">
          {slotsOrder.map(slot => {
            const equippedItem = player.equipped[slot.type];
            const rarityStyle = equippedItem ? RARITY_COLORS[equippedItem.rarity] : null;

            return (
              <div
                key={slot.type}
                onClick={() => equippedItem && setSelectedItem(equippedItem)}
                className={`relative p-2 rounded-xl border flex flex-col items-center justify-center min-h-[64px] transition-all cursor-pointer ${
                  equippedItem
                    ? `${rarityStyle?.border} ${rarityStyle?.bg} shadow-sm active:scale-95`
                    : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                {equippedItem ? (
                  <>
                    <span className="text-xl mb-0.5">{equippedItem.icon}</span>
                    <span className="text-[10px] font-medium text-slate-200 truncate w-full text-center">
                      {equippedItem.name}
                    </span>
                    {equippedItem.upgradeLevel > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-950 border border-amber-400 text-amber-300 text-[9px] font-mono font-bold px-1 rounded-full shadow-sm">
                        +{equippedItem.upgradeLevel}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-base opacity-40">{slot.icon}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5 truncate w-full text-center">
                      {slot.label}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* INVENTORY BAG SECTION */}
      <div className="space-y-3">
        {/* Header & Capacity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-cinzel text-xs font-bold text-slate-200 uppercase tracking-wider">
              Инвентарь
            </span>
            <span className="text-xs font-mono text-cyan-400">
              ({player.inventory.length} / {player.maxInventorySlots})
            </span>
          </div>

          <button
            onClick={expandInventory}
            className="text-[11px] font-medium px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Сумка +10</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            Все ({player.inventory.length})
          </button>
          <button
            onClick={() => setFilterType('equipment')}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterType === 'equipment'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            Экипировка
          </button>
          <button
            onClick={() => setFilterType('potions')}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterType === 'potions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            Зелья
          </button>
          <button
            onClick={() => setFilterType('materials')}
            className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterType === 'materials'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            Ресурсы
          </button>
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400 text-xs">
            В этом разделе пока нет предметов.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filteredItems.map(item => {
              const rarityStyle = RARITY_COLORS[item.rarity];
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center min-h-[76px] transition-all cursor-pointer ${rarityStyle.border} ${rarityStyle.bg} hover:scale-[1.02] active:scale-95`}
                >
                  {/* Item level badge */}
                  <span className="absolute -top-1.5 -left-1 bg-slate-900 border border-slate-700 text-cyan-300 text-[8px] font-mono font-bold px-1 rounded shadow-sm">
                    Ур.{item.level}
                  </span>

                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-8 h-8 object-contain rounded mb-1" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-2xl mb-1">{item.icon}</span>
                  )}
                  <span className="text-[10px] font-medium text-slate-200 truncate w-full text-center">
                    {item.name}
                  </span>

                  {/* Upgrade level badge */}
                  {item.upgradeLevel > 0 && (
                    <span className="absolute -top-1.5 -right-1 bg-amber-950 border border-amber-400 text-amber-300 text-[9px] font-mono font-bold px-1 rounded-full shadow-sm">
                      +{item.upgradeLevel}
                    </span>
                  )}

                  {/* Stack count */}
                  {item.stackCount && item.stackCount > 1 && (
                    <span className="absolute bottom-1 right-1.5 text-[9px] font-mono text-cyan-300 font-bold bg-slate-950/80 px-1 rounded">
                      x{item.stackCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ITEM DETAIL MODAL */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-4 bg-[#0a0f1d] shadow-2xl space-y-3.5 ${RARITY_COLORS[selectedItem.rarity].border}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {selectedItem.image ? (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-slate-700 p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-800">
                    {selectedItem.icon}
                  </span>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-cinzel text-sm font-bold text-slate-100">
                      {selectedItem.name}
                    </h3>
                    {selectedItem.upgradeLevel > 0 && (
                      <span className="text-amber-400 font-mono font-bold text-xs">
                        +{selectedItem.upgradeLevel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                      Ур. {selectedItem.level}
                    </span>
                    <span className={`text-[10px] font-bold ${RARITY_COLORS[selectedItem.rarity].text}`}>
                      {RARITY_COLORS[selectedItem.rarity].label}
                    </span>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {selectedItem.type}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
              {selectedItem.description}
            </p>

            {/* Stats Breakdown */}
            {selectedItem.stats && Object.keys(selectedItem.stats).length > 0 && (
              <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  Характеристики предмета:
                </div>
                {Object.entries(selectedItem.stats).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300 capitalize">{k}:</span>
                    <span className="text-emerald-400 font-bold">+{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Price & Yield */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
              <span>Стоимость продажи: <span className="text-amber-400 font-bold">{selectedItem.sellPrice} 🪙</span></span>
              <span>Разбор: <span className="text-cyan-400 font-bold">+{selectedItem.disassembleYield?.shards || 1} 💠</span></span>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {selectedItem.isEquipped ? (
                <button
                  onClick={() => {
                    unequipItem(selectedItem.type);
                    setSelectedItem(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Снять</span>
                </button>
              ) : (
                !['potion', 'material', 'ore'].includes(selectedItem.type) && (
                  <button
                    onClick={() => {
                      equipItem(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Экипировать</span>
                  </button>
                )
              )}

              {/* Blacksmith redirect */}
              {!['potion', 'material', 'ore'].includes(selectedItem.type) && onNavigateToBlacksmith && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    onNavigateToBlacksmith();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-purple-950 border border-purple-500/50 hover:border-purple-400 text-purple-200 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Hammer className="w-4 h-4 text-purple-400" />
                  <span>В кузницу</span>
                </button>
              )}

              {/* Disassemble */}
              <button
                onClick={() => {
                  disassembleItem(selectedItem);
                  setSelectedItem(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-medium text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Разобрать</span>
              </button>

              {/* Sell */}
              <button
                onClick={() => {
                  sellItem(selectedItem);
                  setSelectedItem(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-amber-300 font-medium text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Продать</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
