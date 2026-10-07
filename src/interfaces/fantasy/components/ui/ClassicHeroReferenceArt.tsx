import {useState} from 'react';
import {RpgIcon} from './RpgIcon';
import {HERO_REFERENCE_REGIONS,type HeroReferenceRegion} from './HeroReferenceArt';
export default function ClassicHeroReferenceArt({ region, className='', stretch=false }: { region:HeroReferenceRegion; className?:string; stretch?:boolean }) {
  const [failed,setFailed]=useState(false);
  return <span className={`hero-reference-art ${className}`} aria-hidden="true" data-reference-region={region}>
    {failed ? <RpgIcon kind="character" size={24}/> : <svg viewBox={HERO_REFERENCE_REGIONS[region]} preserveAspectRatio={stretch?'none':'xMidYMid meet'} width="100%" height="100%"><image href="/assets/sprites/reference/hero-codex.jpg" width="1280" height="1152" onError={()=>setFailed(true)}/></svg>}
  </span>;
}

