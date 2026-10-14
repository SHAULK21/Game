import type {PlayerCharacter,WorldJourney,WorldPlace} from '../types/game';
import type {GameTabId} from '../types/navigation';
// Device settings, statistics and the journal are accessible independently of travel.
export const SETTLEMENT_TABS:readonly GameTabId[]=['arena','blacksmith','crafting','alchemy','mine','fishing','market','clan','pets','chat'];
export const SETTLEMENT_REQUIRED='Сначала доберитесь до поселения.';
export function worldPlace(player:Pick<PlayerCharacter,'worldPlace'>|null):WorldPlace {
  return ['field','settlement','dungeon'].includes(player?.worldPlace||'')?player!.worldPlace!:'field';
}
export function inSettlement(player:Pick<PlayerCharacter,'worldPlace'|'worldJourney'>|null) {
  return worldPlace(player)==='settlement'&&!player?.worldJourney;
}
export function normalizeWorldJourney(value:unknown,regionIds:readonly string[]):WorldJourney|undefined {
  if(!value||typeof value!=='object')return undefined;
  const j=value as WorldJourney;
  if(typeof j.id!=='string'||!['field','settlement','dungeon'].includes(j.destination)||!regionIds.includes(j.regionId)||!Number.isFinite(j.startedAt)||!Number.isFinite(j.arrivesAt)||j.arrivesAt<=j.startedAt||j.arrivesAt-j.startedAt>10000)return undefined;
  return j;
}
