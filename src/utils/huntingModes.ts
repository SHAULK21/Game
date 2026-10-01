import {REGION_MODIFIERS,REGIONS} from '../data/gameData';
import type {Monster,RegionModifier} from '../types/game';
export function applyHuntingMode(monster:Monster,mode?:RegionModifier):Monster {
 if(!mode || !REGIONS.some(region=>region.id===monster.regionId))return monster;
 const hp=Math.max(1,Math.round(monster.maxHp*(mode.hpMultiplier||1)));
 return {...monster,hp,maxHp:hp,defense:Math.round(monster.defense*(mode.defenseMultiplier||1)),magicDefense:Math.round(monster.magicDefense*(mode.defenseMultiplier||1)),huntingModeId:mode.id};
}
export const combatHuntingMode=(monster:Monster|null|undefined):RegionModifier=>REGION_MODIFIERS[monster?.huntingModeId||'mod_standard']||REGION_MODIFIERS.mod_standard;
