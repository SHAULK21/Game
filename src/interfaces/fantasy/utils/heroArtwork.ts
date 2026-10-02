import { CharacterClassId } from '../../../types/game';

/** Presentation only: class stats and saved records stay in the shared game data. */
export const getFantasyHeroArtwork = (id: CharacterClassId): string =>
  `/assets/sprites/generated/heroes/${id}.webp`;
