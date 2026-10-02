import { useState } from 'react';
import { RpgIcon } from './RpgIcon';

// Only artwork regions are displayed; screenshot text and phone chrome are excluded.
export const PET_REFERENCE_REGIONS: Record<string,string> = {
  pet_wolf:'32 302 215 164', pet_dragon:'36 523 160 201',
  pet_fairy:'36 747 160 193', pet_golem:'36 973 160 95'
};
export function PetArtwork({ id, label, className = '' }: { id: string; label?: string; className?: string }) {
  return <PetImage key={id} id={id} label={label} className={className}/>;
}
function PetImage({ id, label, className }: { id:string; label?:string; className:string }) {
  const [failed,setFailed]=useState(false);
  const region=PET_REFERENCE_REGIONS[id];
  return <span className={`pet-artwork ${className}`} role={label?'img':undefined} aria-label={label} aria-hidden={!label}>
    {region&&!failed ? <svg viewBox={region} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><image href="/assets/sprites/reference/pet-codex.jpg" width="578" height="1280" onError={()=>setFailed(true)}/></svg> : <RpgIcon kind="pet" size={64}/>}
  </span>;
}
