import { CharacterClassId } from '../../../types/game';

/** Presentation only: class stats and saved records stay in the shared game data. */
export const getFantasyHeroArtwork = (id: CharacterClassId): string =>
  `/assets/sprites/generated/heroes/${id}.webp`;

/** Full-body art is reserved for the tall equipment frame. */
export const getFantasyEquipmentArtwork = (id: CharacterClassId): string =>
  `/assets/sprites/generated/heroes/${id}-fullbody.webp`;

/** Alpha sprites prepared for compositing into the battle landscape. */
export const getFantasyCombatArtwork = (id: CharacterClassId): string =>
  `/assets/sprites/generated/heroes/combat/${id}.webp`;
