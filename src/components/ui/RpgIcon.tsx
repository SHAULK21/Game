import React from 'react';
import { ItemType } from '../../types/game';

export type RpgIconKind =
  | ItemType
  | 'attack' | 'defend' | 'skill' | 'map' | 'bestiary' | 'monster' | 'character'
  | 'inventory' | 'forge' | 'mine' | 'arena' | 'clan' | 'market' | 'quest'
  | 'settings' | 'more' | 'hunt' | 'crown' | 'hp' | 'gold' | 'silver' | 'energy'
  | 'stamina' | 'ore' | 'herb' | 'water' | 'toxin' | 'pollen' | 'fang' | 'gem'
  | 'shard' | 'alchemy' | 'refresh' | 'leave';

interface RpgIconProps {
  kind: RpgIconKind;
  size?: number;
  className?: string;
  title?: string;
}

const SPRITE_ROOT = '/assets/sprites/generated/ui';

const SPRITES: Record<RpgIconKind, string> = {
  attack: 'icons/attack.webp',
  defend: 'icons/defend.webp',
  skill: 'icons/skill.webp',
  potion: 'icons/potion.webp',
  map: 'icons/map.webp',
  hunt: 'icons/hunt.webp',
  bestiary: 'icons/bestiary.webp',
  character: 'icons/character.webp',
  inventory: 'icons/inventory.webp',
  forge: 'icons/forge.webp',
  mine: 'icons/mine.webp',
  arena: 'icons/arena.webp',
  clan: 'icons/clan.webp',
  market: 'icons/market.webp',
  quest: 'icons/quest.webp',
  settings: 'icons/settings.webp',
  more: 'icons/more.webp',
  refresh: 'icons/refresh.webp',
  leave: 'icons/leave.webp',
  crown: 'icons/crown.webp',
  hp: 'icons/hp.webp',
  gold: 'icons/gold.webp',
  silver: 'icons/silver.webp',
  energy: 'icons/energy.webp',
  stamina: 'icons/stamina.webp',
  monster: 'icons/monster.webp',
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
  artifact: 'gear/artifact.webp',
  pet: 'gear/pet.webp',
  pickaxe: 'gear/pickaxe.webp',
  alchemyTool: 'gear/alchemyTool.webp',
  ore: 'resources/ore.webp',
  material: 'gear/material.webp',
  herb: 'resources/herb.webp',
  water: 'resources/vial.webp',
  toxin: 'resources/vial.webp',
  pollen: 'resources/dust.webp',
  fang: 'resources/fang.webp',
  gem: 'resources/crystal.webp',
  shard: 'resources/crystal.webp',
  alchemy: 'icons/alchemy.webp'
};

export const RpgIcon: React.FC<RpgIconProps> = ({
  kind,
  size = 28,
  className = 'text-[#a48b60]',
  title
}) => (
  <span
    className={`inline-flex items-center justify-center shrink-0 ${className}`}
    title={title}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={!title}
  >
    <img
      src={`${SPRITE_ROOT}/${SPRITES[kind]}`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className="block shrink-0 object-contain"
    />
  </span>
);

export const getRpgIconKind = (item: { type: ItemType; name?: string }): RpgIconKind => {
  const name = (item.name || '').toLowerCase();
  if (item.type === 'ore') return 'ore';
  if (item.type === 'potion') return 'potion';
  if (name.includes('лечеб') || name.includes('трава') || name.includes('цветок') || name.includes('корень')) return 'herb';
  if (name.includes('вода')) return 'water';
  if (name.includes('пыльца')) return 'pollen';
  if (name.includes('клык')) return 'fang';
  if (name.includes('яд')) return 'toxin';
  if (name.includes('самоцвет') || name.includes('алмаз')) return 'gem';
  return item.type;
};
