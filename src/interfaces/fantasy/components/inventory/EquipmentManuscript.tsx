import type { CSSProperties } from 'react';
import type { GameItem, ItemType, PlayerCharacter } from '../../../../types/game';
import { t, useLocale } from '../../../../i18n/locale';
import { ReferenceFrameParts, ReferencePart, type ReferencePartId } from '../ui/ReferencePart';
import { Portrait } from '../ui/Portrait';
import { RpgIcon } from '../ui/RpgIcon';
import { getFantasyEquipmentArtwork } from '../../utils/heroArtwork';
import { InventoryArt } from './InventoryArt';

const LEFT: ItemType[] = ['helmet','weapon','gloves','pants','boots','cloak','pickaxe','alchemyTool'];
const RIGHT: ItemType[] = ['amulet','offhand','armor','ring','belt','artifact'];
const EMPTY: Partial<Record<ItemType,ReferencePartId>> = {
  helmet:'slot-helmet',gloves:'slot-gloves',pants:'slot-pants',boots:'slot-boots',cloak:'slot-cloak',
  pickaxe:'slot-pickaxe',alchemyTool:'slot-retort',amulet:'slot-amulet',offhand:'slot-offhand',ring:'slot-ring',belt:'slot-belt',artifact:'slot-artifact'
};

export function EquipmentManuscript({ player, labels, onSelect }: {
  player:PlayerCharacter; labels:Partial<Record<ItemType,string>>; onSelect:(item:GameItem)=>void;
}) {
  useLocale();
  const artwork = getFantasyEquipmentArtwork(player.classId);
  const slots=(types:ItemType[])=>types.map(type=>{
    const item=player.equipped[type];
    const label=t(labels[type] || type);
    return <button type="button" key={type} disabled={!item} onClick={()=>item && onSelect(item)}
      data-equipment-slot={type} data-rarity={item?.rarity}
      aria-label={`${label}: ${t(item?.name || 'Пусто')}`}
      className={`inventory-equipped-slot ${item ? 'is-filled' : ''}`} title={`${label}: ${t(item?.name || 'Пусто')}`}>
      <ReferenceFrameParts id="equipment" />
      <span className="inventory-equipped-art">{item ? <InventoryArt item={item} size={32}/>
        : EMPTY[type] ? <ReferencePart id={EMPTY[type]!}/> : <RpgIcon kind={type} size={26}/>}</span>
      <span className="inventory-equipped-copy"><span>{label}</span><strong>{t(item?.name || 'Пусто')}</strong></span>
      {item && item.upgradeLevel>0 && <span className="inventory-equipped-upgrade">+{item.upgradeLevel}</span>}
    </button>;
  });
  return <div className="inventory-paper-doll">
    <div className="inventory-slot-column">{slots(LEFT)}</div>
    <figure className="inventory-hero-art is-full-body" style={{ '--equipment-art': `url("${artwork}")` } as CSSProperties}>
      <Portrait src={artwork} alt={player.name} fallback="character" className="inventory-class-art"/>
      <figcaption>{player.name}</figcaption>
    </figure>
    <div className="inventory-slot-column">{slots(RIGHT)}</div>
  </div>;
}
