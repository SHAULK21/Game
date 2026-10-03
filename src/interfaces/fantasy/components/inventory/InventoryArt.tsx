import type { GameItem } from '../../../../types/game';
import { ItemArtwork } from '../ui/ItemArtwork';
import { ReferencePart, type ReferencePartId } from '../ui/ReferencePart';
import { t } from '../../../../i18n/locale';

/** Original pieces only for matching items; other equipment keeps its own sprite. */
export function InventoryArt({ item, size = 40 }: { item: GameItem; size?: number }) {
  const part: ReferencePartId | undefined = item.templateId === 'hammer_radiant' ? 'item-hammer'
    : item.type === 'potion' && item.name === 'Малое зелье исцеления' ? 'item-health-potion'
    : item.name === 'Железная руда' ? 'item-ore'
    : item.name === 'Лечебная трава' ? 'item-herb'
    : item.name === 'Древесина' ? 'item-wood' : undefined;
  return part ? <span className="inventory-original-item" style={{ width:size,height:size }}><ReferencePart id={part} label={t(item.name)} /></span>
    : <ItemArtwork item={item} size={size} />;
}
