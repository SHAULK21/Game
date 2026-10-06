import React from 'react';
import { t as localize, useLocale } from '../../i18n/locale';
import { useGame } from '../../context/GameContext';
import { GameItem, ItemType } from '../../types/game';
import { ItemArtwork } from '../../components/ui/ItemArtwork';
import { RpgIcon } from '../../components/ui/RpgIcon';
import { RARITY_COLORS } from '../../data/gameData';
const slots = [
  ['helmet', 'Шлем'], ['amulet', 'Амулет'], ['weapon', 'Оружие'], ['offhand', 'Второе оружие'],
  ['armor', 'Доспех'], ['cloak', 'Плащ'], ['gloves', 'Перчатки'], ['ring', 'Кольцо'],
  ['pants', 'Штаны'], ['belt', 'Пояс'], ['boots', 'Сапоги'], ['artifact', 'Артефакт'],
] as const;
export function HeroEquipment({ onSelect, onOpenInventory }: { onSelect?: (item: GameItem) => void; onOpenInventory?: () => void }) {
  useLocale();
  const { player, combatStats, combatPlayerHp, combatPlayerMp, isInCombat } = useGame();
  if (!player) return null;
  const hp = isInCombat ? combatPlayerHp : combatStats.maxHp;
  const mp = isInCombat ? combatPlayerMp : combatStats.maxMp;
  const renderSlot = ([type, label]: typeof slots[number]) => {
    const item = player.equipped[type as ItemType];
    return <button key={type} data-modern-equipment-slot={type} className={`modern-gear-slot ${item ? RARITY_COLORS[item.rarity].border : ''}`} title={localize(item?.name || label)} aria-label={localize(item ? `${label}: ${item.name}` : `${label}: Пусто`)} onClick={() => { if (onSelect && item) onSelect(item); else onOpenInventory?.(); }}>
      {item ? <ItemArtwork item={item} size={36} /> : <RpgIcon kind={type} size={30} className="text-stone-500" />}
      <span>{localize(label)}</span>{item && item.upgradeLevel > 0 && <b>+{item.upgradeLevel}</b>}
    </button>;
  };
  return <section className="modern-hero-equipment" aria-label={localize("Снаряжение")}>
    <div className="modern-hero-scene"><img src={`/assets/sprites/generated/heroes/${player.classId}-fullbody.webp`} alt={player.name} /></div>
    <div className="modern-gear-side">{slots.filter((_, i) => i % 2 === 0).map(renderSlot)}</div>
    <div className="modern-gear-side is-right">{slots.filter((_, i) => i % 2 === 1).map(renderSlot)}</div>
    <div className="modern-vitals"><div className="modern-vital is-hp"><span style={{ width: `${Math.max(0, Math.min(100, hp / combatStats.maxHp * 100))}%` }} /><b>HP {Math.round(hp)} / {combatStats.maxHp}</b></div><div className="modern-vital is-mp"><span style={{ width: `${Math.max(0, Math.min(100, mp / combatStats.maxMp * 100))}%` }} /><b>MP {Math.round(mp)} / {combatStats.maxMp}</b></div></div>
  </section>;
}
