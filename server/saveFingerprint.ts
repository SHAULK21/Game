import {canonicalJson} from '../src/utils/canonicalJson';
import type {ServerSave} from './gameStore';
/** Only the derived travel percentage is ignored. Share all other save branches
 * read-only instead of cloning the entire actor/inventory before serialization. */
export function meaningfulSave(save:ServerSave){
 const travel=save.actor?.state.travelState as any;
 if(!travel?.isTraveling)return canonicalJson(save);
 return canonicalJson({...save,actor:{...save.actor,state:{...save.actor.state,travelState:{...travel,progress:0}}}});
}
