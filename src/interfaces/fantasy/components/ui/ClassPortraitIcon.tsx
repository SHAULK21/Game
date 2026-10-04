import { useState } from 'react';
import type { CharacterClassId } from '../../../../types/game';
import { ClassIcon } from '../../../../components/ui/ClassIcon';
import { getFantasyHeroArtwork } from '../../utils/heroArtwork';

type Props = { classId: CharacterClassId; className?: string; label?: string };
/** Use the same current class artwork as registration, character sheet and combat. */
export function ClassPortraitIcon(props: Props) {
  return <ClassPortraitImage key={props.classId} {...props} />;
}
function ClassPortraitImage({ classId, className = '', label }: Props) {
  const [failed, setFailed] = useState(false);
  return <span className={`class-portrait-icon ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}>
    {failed ? <ClassIcon classId={classId} className="h-full w-full p-2" /> :
      <img src={getFantasyHeroArtwork(classId)} alt="" decoding="async" className="h-full w-full object-cover object-top" onError={() => setFailed(true)} />}
  </span>;
}
