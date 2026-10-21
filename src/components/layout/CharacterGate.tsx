import React, {createContext, useEffect, useState} from 'react';
import {apiRequest} from '../../utils/api';
import {getTelegramAccount, isInsideTelegram} from '../../utils/telegram';
import {activateCharacter, readCharacterSlot, type CharacterSummary} from '../../utils/characterSession';
export const CharactersContext = createContext<{characters: CharacterSummary[]; limit: number} | null>(null);
export function CharacterGate({children}: React.PropsWithChildren) {
  const online = isInsideTelegram(), owner = String(getTelegramAccount().id);
  const [result,setResult] = useState<{characters: CharacterSummary[]; limit: number} | null>(null);
  const [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if (!online) return;
    let alive = true; setError('');
    apiRequest<{characters: CharacterSummary[]; limit: number}>('/api/characters', {signal: AbortSignal.timeout(15000)})
      .then(data => {
        if (!alive) return;
        const character = data.characters.find(item => item.slot === readCharacterSlot(owner)) || data.characters.find(item => item.slot === 0);
        if (!character) throw new Error('Не удалось загрузить список персонажей.');
        activateCharacter(owner,character); setResult(data);
      }).catch(reason => {if (alive) setError(String(reason.message || reason));});
    return () => {alive = false;};
  }, [online,owner,attempt]);
  if (!online) return <>{children}</>;
  if (!result) return <section className="p-6 text-center" role="status"><p>{error || 'Загрузка персонажей…'}</p>{error && <button className="min-h-11 underline" onClick={()=>setAttempt(value=>value+1)}>Повторить</button>}</section>;
  return <CharactersContext.Provider value={result}>{children}</CharactersContext.Provider>;
}
