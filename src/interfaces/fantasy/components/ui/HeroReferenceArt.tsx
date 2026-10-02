import { useState } from 'react';
import { RpgIcon } from './RpgIcon';

// Original raster fragments displayed through SVG viewports, without redrawing.
export const HERO_REFERENCE_REGIONS = {
  frame:'0 64 1280 993', title:'498 80 380 67', close:'1004 88 39 43', paper:'710 665 270 46', castle:'879 83 148 305',
  necromancer:'265 109 225 289', strength:'331 508 38 39', agility:'706 508 38 39',
  intelligence:'330 564 38 40', vitality:'707 563 38 38', luck:'331 618 38 40',
  spirit:'707 617 38 40', willpower:'331 672 38 41', hp:'342 777 32 31',
  mana:'707 777 32 31', attack:'342 814 32 29', magic:'707 814 32 29',
  defense:'342 848 32 31', magicDefense:'707 848 32 31', critical:'344 894 36 30',
  accuracy:'344 933 36 32', recovery:'344 975 36 31', rewards:'344 1015 36 31',
  plus:'620 512 39 39', tabActive:'332 409 180 51', tab:'510 409 174 51'
} as const;
export type HeroReferenceRegion = keyof typeof HERO_REFERENCE_REGIONS;
export function HeroReferenceArt({ region, className='', stretch=false }: { region:HeroReferenceRegion; className?:string; stretch?:boolean }) {
  const [failed,setFailed]=useState(false);
  return <span className={`hero-reference-art ${className}`} aria-hidden="true" data-reference-region={region}>
    {failed ? <RpgIcon kind="character" size={24}/> : <svg viewBox={HERO_REFERENCE_REGIONS[region]} preserveAspectRatio={stretch?'none':'xMidYMid meet'} width="100%" height="100%"><image href="/assets/sprites/reference/hero-codex.jpg" width="1280" height="1152" onError={()=>setFailed(true)}/></svg>}
  </span>;
}
