import { GameItem } from '../../../types/game';
import { getResourceArtwork } from './resourceArtwork';
import { getItemSpritePath } from '../../../utils/itemSprites';

const ITEM_SPRITES: Record<Exclude<GameItem['type'], 'ore' | 'material'>, string> = {
  weapon: 'gear/weapon.webp',
  offhand: 'gear/offhand.webp',
  helmet: 'gear/helmet.webp',
  armor: 'gear/armor.webp',
  pants: 'gear/pants.webp',
  gloves: 'gear/gloves.webp',
  boots: 'gear/boots.webp',
  amulet: 'gear/amulet.webp',
  ring: 'gear/ring.webp',
  belt: 'gear/belt.webp',
  cloak: 'gear/cloak.webp',
  pet: 'gear/pet.webp',
  pickaxe: 'gear/pickaxe.webp',
  alchemyTool: 'gear/alchemyTool.webp',
  artifact: 'gear/artifact.webp',
  potion: 'icons/potion.webp'
};

/** Always resolve through the generated sprite catalog, even for older saved item records. */
export const getItemArtworkPath = (item: Pick<GameItem, 'name' | 'type'> & Partial<Pick<GameItem,'image'|'weaponClass'>>): string => {
  if (item.image && (item.type==='pickaxe' || item.type==='alchemyTool' || item.image.startsWith('/assets/fishing/'))) return item.image;
  if (item.type === 'weapon') {
    const sprite = getItemSpritePath(item);
    if (sprite && !sprite.endsWith('/sword.webp')) return sprite;
  }
  if (item.type === 'potion') return getItemSpritePath(item)!;
  if (item.type === 'ore' || item.type === 'material') return getResourceArtwork(item.name, item.type);
  return `/assets/sprites/generated/ui/${ITEM_SPRITES[item.type]}`;
};
