import type { GameItem } from '../types/game';

export const ITEM_SPRITES = {
  sword:'sword', hammer:'hammer', axe:'axe', dagger:'dagger', bow:'bow', staff:'staff', shield:'shield',
  helmet:'helmet', armor:'armor', gloves:'gloves', boots:'boots', pants:'pants',
  belt:'belt', cloak:'cloak', ring:'ring', amulet:'amulet', pickaxe:'pickaxe', retort:'retort',
  health:'health-potion', mana:'mana-potion', iron:'iron-ore', silver:'silver-ore', copper:'copper-ore', gold:'gold-ore',
  crystal:'crystal', herb:'herb', hide:'hide', fang:'fang', thread:'thread', meat:'meat', coin:'coin', seal:'seal'
} as const;
export type ItemSprite = keyof typeof ITEM_SPRITES;
export const spritePath = (key: ItemSprite) => `/assets/items/sprites/${ITEM_SPRITES[key]}.webp`;

export function getResourceSprite(name: string): string | undefined {
  const n = name.toLowerCase();
  let key: ItemSprite | undefined;
  if (/медн.*руда/.test(n)) key='copper';
  else if (/золот.*руда/.test(n)) key='gold';
  else if (/железн.*руда/.test(n)) key='iron';
  else if (/серебрян.*руда/.test(n)) key='silver';
  else if (/шкур/.test(n)) key='hide';
  else if (/клык/.test(n)) key='fang';
  else if (/мясо/.test(n)) key='meat';
  else if (/нить|шёлк|шелк/.test(n)) key='thread';
  else if (/монет/.test(n)) key='coin';
  else if (/трава/.test(n)) key='herb';
  else if (/знак элиты|печать покорителя/.test(n)) key='seal';
  else if (/кристалл|самоцвет|алмаз|призма/.test(n)) key='crystal';
  return key ? spritePath(key) : undefined;
}

export function getItemSpritePath(item: Pick<GameItem,'name'> & {type?: GameItem['type'];weaponClass?:GameItem['weaponClass']}): string | undefined {
  const n = item.name.toLowerCase();
  if (item.type==='ore' || item.type==='material') return getResourceSprite(n);
  if (item.type==='weapon') {
    if (item.weaponClass==='dagger' || /кинжал|парные клинки/.test(n)) return spritePath('dagger');
    if (item.weaponClass==='bow' || /лук|арбалет/.test(n)) return spritePath('bow');
    if (item.weaponClass==='staff' || /посох|жезл/.test(n)) return spritePath('staff');
    if (/топор|секир/.test(n)) return spritePath('axe');
    if (/молот|булав/.test(n)) return spritePath('hammer');
    if (/коса/.test(n)) return undefined;
    return spritePath('sword');
  }
  if (item.type==='offhand') return spritePath(/фокус|сфер|том|гримуар/.test(n)?'crystal':'shield');
  if (item.type==='potion') {
    if (/маны|мана/.test(n)) return spritePath('mana');
    if (/исцелен|здоров|жизн|лечеб/.test(n)) return spritePath('health');
    return spritePath('retort');
  }
  const slots: Partial<Record<GameItem['type'], ItemSprite>> = {
    helmet:'helmet',armor:'armor',gloves:'gloves',boots:'boots',pants:'pants',belt:'belt',
    cloak:'cloak',ring:'ring',amulet:'amulet',pickaxe:'pickaxe',alchemyTool:'retort',artifact:'crystal'
  };
  const key=item.type && slots[item.type];
  return key ? spritePath(key) : undefined;
}
