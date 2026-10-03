import { useEffect, useRef, useState } from 'react';
import type { BattleLogEntry } from '../types/game';

/** Brief impact feedback survives the transition back to the player's turn. */
export function useMonsterStrike(log: BattleLogEntry[], inCombat: boolean) {
  const id = [...log].reverse().find(entry => entry.id.startsWith('m_atk_') || entry.id.startsWith('monster_skill_damage_'))?.id;
  const previous = useRef(id);
  const [striking, setStriking] = useState(false);
  useEffect(() => {
    if (!inCombat) { previous.current = id; setStriking(false); return; }
    if (!id || previous.current === id) return;
    previous.current = id;
    setStriking(true);
    const timer = setTimeout(() => setStriking(false), 450);
    return () => clearTimeout(timer);
  }, [id, inCombat]);
  return striking;
}
