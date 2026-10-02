import { GameItem } from '../types/game';
import { getItemSpritePath } from './itemSprites';
import { getResourceArtwork } from './resourceArtwork';

const transliterate = (value: string) => value
  .toLowerCase()
  .replace(/ё/g, 'yo')
  .replace(/[а-я]/g, ch => ({
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
    н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',
    щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  } as Record<string,string>)[ch] ?? ch)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const PREFIXES = ['легендарный ', 'эпический ', 'редкий ', 'улучшенный '];

export const getBaseItemArtworkName = (name: string) => {
  let normalized = name.trim();
  const lower = normalized.toLowerCase();
  for (const prefix of PREFIXES) {
    if (lower.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }
  return normalized;
};

export const getItemArtworkSlug = (name: string) => transliterate(getBaseItemArtworkName(name));

export const getItemArtworkPath = (item: Pick<GameItem, 'name' | 'image'> & { type?: GameItem['type'] }) =>
  item.image || (item.type === 'ore' || item.type === 'material'
    ? getResourceArtwork(item.name, item.type)
    : getItemSpritePath(item) || `/assets/items/${getItemArtworkSlug(item.name)}.webp`);
