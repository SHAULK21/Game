import {NativePool} from './pool';
import {CHARACTER_LIMIT, characterSummary} from '../characters';
export function nativeCharacters(pool: NativePool, owner: number) {
  const links = pool.table('account_characters').filter(row => Number(row.owner_id) === owner);
  return {characters: [{slot: 0, character_id: owner}, ...links].map(link =>
    characterSummary(link.slot, pool.table('players').find(row => Number(row.telegram_id) === Number(link.character_id))!)), limit: CHARACTER_LIMIT};
}
export function addNativeCharacter(pool: NativePool, identity: {id: number; displayName: string; username?: string}, slot: number) {
  if (!slot || pool.table('account_characters').some(row => Number(row.owner_id) === identity.id && row.slot === slot)) return;
  const id = pool.table('players').reduce((min,row)=>Math.min(min,Number(row.telegram_id)),0) - 1;
  if (!Number.isSafeInteger(id)) throw new Error('Character ID exhausted');
  pool.table('account_characters').push({owner_id: identity.id, slot, character_id: id});
  pool.ensurePlayer({...identity, id});
}
