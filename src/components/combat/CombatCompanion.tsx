import { useState } from 'react';
import type { Pet } from '../../types/game';
import { t } from '../../i18n/locale';

const placements: Record<string, 'feet' | 'shoulder'> = {
  pet_wolf: 'feet', pet_golem: 'feet',
  pet_dragon: 'shoulder', pet_fairy: 'shoulder', pet_voidling: 'shoulder'
};

/** Decorative only: the active companion's combat bonuses remain in GameContext. */
export function CombatCompanion({ pet, compact = false }: { pet?: Pet; compact?: boolean }) {
  return pet && placements[pet.id]
    ? <CompanionImage key={pet.id} pet={pet} compact={compact} />
    : null;
}

function CompanionImage({ pet, compact }: { pet: Pet; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <span className={`combat-companion at-${placements[pet.id]}${compact ? ' is-compact' : ''}`}>
    <img src={`/assets/sprites/generated/pets/combat/${pet.id}.webp`} alt={t(pet.name)}
      draggable={false} onError={() => setFailed(true)} />
  </span>;
}
