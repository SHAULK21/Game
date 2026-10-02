import { useState } from 'react';
import type { CharacterClassId } from '../../../../types/game';
import { ClassIcon } from '../../../../components/ui/ClassIcon';

// The reference contains eight complete portraits. Related martial classes share
// a portrait; the clipped tile at the left edge is deliberately not used.
export const CLASS_PORTRAIT_X = { warrior:62, knight:62, berserker:174, rogue:284,
  assassin:284, archer:394, mage:504, necromancer:614, paladin:724, druid:834
} satisfies Record<CharacterClassId, number>;

export function ClassPortraitIcon({ classId, className = '', label }: { classId: CharacterClassId; className?: string; label?: string }) {
  const [failed,setFailed] = useState(false);
  return <span className={`class-portrait-icon ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}>
    {failed ? <ClassIcon classId={classId} className="h-full w-full p-2" /> :
      <svg viewBox={`${CLASS_PORTRAIT_X[classId]} 23 100 100`} aria-hidden="true" width="100%" height="100%">
        <image href="/assets/sprites/reference/class-portraits.jpg" width="960" height="133" onError={()=>setFailed(true)} />
      </svg>}
  </span>;
}
