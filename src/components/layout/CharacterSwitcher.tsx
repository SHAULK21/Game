import React, {useContext, useEffect, useState} from 'react';
import {CharactersContext} from './CharacterGate';
import {ServerProgressContext} from '../../context/ServerProgressContext';
import {useGame} from '../../context/GameStateContext';
import {apiRequest} from '../../utils/api';
import {getTelegramAccount} from '../../utils/telegram';
import {characterSelectionKey, selectedCharacter, type CharacterSummary} from '../../utils/characterSession';
import {useLocale} from '../../i18n/locale';

export function CharacterSwitcher() {
  const initial = useContext(CharactersContext), client = useContext(ServerProgressContext);
  const game = useGame(), {locale} = useLocale(), uk = locale === 'uk';
  const [data,setData] = useState(initial), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  useEffect(()=>{if(initial) apiRequest<NonNullable<typeof initial>>('/api/characters').then(setData).catch(()=>{});},[initial]);
  if (!data) return null;
  const owner = getTelegramAccount().id, selected = selectedCharacter(owner)?.slot || 0;
  const block = () => {
    if (client?.pending || client?.requestInFlight || client?.status !== 'saved') return uk ? 'Дочекайтеся збереження прогресу.' : 'Дождитесь сохранения прогресса.';
    return game.getInterfaceSwitchBlockReason();
  };
  const select = (character: CharacterSummary) => {
    const reason = block(); if(reason) {setError(reason);return;}
    try {
      game.flushProgress();
      sessionStorage.setItem(characterSelectionKey(owner),String(character.slot));
      window.location.reload();
    } catch {setBusy(false);setError(uk ? 'Не вдалося зберегти вибір персонажа.' : 'Не удалось сохранить выбор персонажа.');}
  };
  const add = async () => {
    const reason = block(); if(reason) {setError(reason);return;}
    const slot = Array.from({length:data.limit},(_,i)=>i).find(slot=>!data.characters.some(item=>item.slot===slot));
    if(slot === undefined) return;
    setBusy(true);setError('');
    try {
      const next = await apiRequest<NonNullable<typeof initial>>('/api/characters',{method:'POST',body:JSON.stringify({slot})});
      setData(next);setBusy(false);
      const character=next.characters.find(item=>item.slot===slot);
      if(character) select(character);
    } catch(reason) {setError(reason instanceof Error?reason.message:String(reason));setBusy(false);}
  };
  return <section className="my-3 rounded-xl border border-slate-500/40 p-3 space-y-2" aria-label={uk?'Персонажі':'Персонажи'}>
    <h2>{uk?'Персонажі':'Персонажи'} · {data.characters.length}/{data.limit}</h2>
    <p className="text-sm">{uk?'Окремий прогрес та інвентар. Premium спільний для акаунта.':'Отдельный прогресс и инвентарь. Premium общий для аккаунта.'}</p>
    {data.characters.map(character=><button key={character.slot} className="block w-full min-h-11 rounded border border-slate-500/40 p-2 text-left disabled:opacity-60" aria-pressed={character.slot===selected} disabled={busy || character.slot===selected} onClick={()=>select(character)}>
      {character.name || (uk?'Новий персонаж':'Новый персонаж')} · {uk?'рів.':'ур.'} {character.level}{character.slot===selected ? (uk?' · Обрано':' · Выбран'):''}
    </button>)}
    {data.characters.length<data.limit && <button className="min-h-11 underline" disabled={busy} onClick={()=>void add()}>{busy?'…':uk?'Створити персонажа':'Создать персонажа'}</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
