import { CLASSES as sharedClasses, ASSETS as sharedAssets } from '../../../data/gameData';
import cave from '../../../assets/battle/cave-bat.webp';
import { getFantasyHeroArtwork } from '../utils/heroArtwork';
export * from '../../../data/gameData';

export const CLASSES: typeof sharedClasses = Object.fromEntries(
  Object.entries(sharedClasses).map(([id, definition]) => [id, {
    ...definition, image: getFantasyHeroArtwork(definition.id)
  }])
) as typeof sharedClasses;

export const ASSETS = {
  ...sharedAssets,
  heroHunter: '/assets/sprites/generated/heroes/hunter.webp',
  charWarrior: getFantasyHeroArtwork('warrior'),
  charMage: getFantasyHeroArtwork('mage'),
  charRogue: getFantasyHeroArtwork('rogue'),
  mobWolf: '/assets/sprites/generated/monsters/m_wolf.webp',
  mobGoblin: '/assets/sprites/generated/monsters/m_goblin.webp',
  mobDeathKnight: '/assets/sprites/generated/monsters/m_death_knight_boss.webp',
  bossDragon: '/assets/sprites/generated/monsters/m_dragon_boss.webp',
  relicWeapon: '/assets/sprites/generated/ui/gear/weapon.webp',
  itemRelicShield: '/assets/sprites/generated/ui/gear/offhand.webp',
  itemRelicHelm: '/assets/sprites/generated/ui/gear/helmet.webp',
  dungeonCave: cave
};
