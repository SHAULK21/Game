export interface CharacterSummary {slot: number; id: string; name: string; level: number; classId: string | null}
let active: {owner: string; character: CharacterSummary} | null = null;
export const selectedCharacter = (owner: string | number) => active?.owner === String(owner) ? active.character : null;
export function activateCharacter(owner: string | number, character: CharacterSummary) {active = {owner: String(owner), character};}
export const characterSelectionKey = (owner: string | number) => 'aethelgard_character_slot_' + owner;
export function readCharacterSlot(owner: string | number) {
  try {const slot = sessionStorage.getItem(characterSelectionKey(owner)); return slot && /^[0-4]$/.test(slot) ? Number(slot) : 0;}
  catch {return 0;}
}
