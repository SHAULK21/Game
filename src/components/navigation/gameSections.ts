import {useEffect,useState} from 'react';
import type {GameTabId} from '../../types/navigation';
import {readResetVersion} from '../../utils/accountReset';
import {getTelegramUser} from '../../utils/telegram';
export type JournalSection='quests'|'achievements'|'stats'|'leaderboard'|'premium'|'notifications'|'journal'|'settings';
export type WorldSection='lands'|'dungeons'|'activities';
export interface GameSection {id:string;label:string;icon:string;tab:GameTabId;journal?:JournalSection;world?:WorldSection}
export const GAME_SECTION_GROUPS:{label:string;hint:string;items:GameSection[]}[]=[
 {label:'Сражения',hint:'Проверьте свою силу',items:[{id:'arena',label:'Арена',icon:'arena',tab:'arena'},{id:'hunt',label:'Охота',icon:'hunt',tab:'hunter'},{id:'dungeons',label:'Подземелья',icon:'map',tab:'world',world:'dungeons'}]},
 {label:'Ремесло и добыча',hint:'Создавайте. Добывайте. Развивайтесь.',items:[{id:'crafting',label:'Создание',icon:'forge',tab:'crafting'},{id:'blacksmith',label:'Кузница',icon:'forge',tab:'blacksmith'},{id:'alchemy',label:'Алхимия',icon:'alchemy',tab:'alchemy'},{id:'mine',label:'Шахта',icon:'mine',tab:'mine'},{id:'fishing',label:'Рыбалка',icon:'fish',tab:'fishing'}]},
 {label:'Сообщество',hint:'Вместе мы сильнее',items:[{id:'clan',label:'Клан',icon:'clan',tab:'clan'},{id:'chat',label:'Чат',icon:'quest',tab:'chat'},{id:'market',label:'Рынок',icon:'market',tab:'market'},{id:'leaderboard',label:'Рейтинг',icon:'crown',tab:'leaderboard'}]},
 {label:'Развитие',hint:'Становитесь сильнее каждый день',items:[{id:'pets',label:'Спутники',icon:'pet',tab:'pets'},{id:'quests',label:'Задания',icon:'quest',tab:'more',journal:'quests'},{id:'achievements',label:'Достижения',icon:'crown',tab:'more',journal:'achievements'},{id:'hero',label:'Герой',icon:'character',tab:'character'}]},
];
export const ALL_GAME_SECTIONS=GAME_SECTION_GROUPS.flatMap(g=>g.items);
const targetKey=(kind:string)=>`aethelgard_ui_target_${kind}_${getTelegramUser().id}`;
export function requestGameSection(item:GameSection,navigate:(tab:GameTabId)=>void){
 const kind=item.journal?'journal':item.world?'world':null;const value=item.journal||item.world;
 if(kind){try{sessionStorage.setItem(targetKey(kind),value!);}catch{}window.dispatchEvent(new CustomEvent('aethelgard:section-target',{detail:{kind,value}}));}
 navigate(item.tab);
}
/** Supports both mounting a new screen and selecting a subsection of the current one. */
export function useSectionTarget<T extends string>(kind:string,valid:readonly T[],fallback:T){
 const take=()=>{try{const value=sessionStorage.getItem(targetKey(kind)) as T;sessionStorage.removeItem(targetKey(kind));return valid.includes(value)?value:null;}catch{return null;}};
 const contextKey=`${targetKey(kind)}_context_${readResetVersion(getTelegramUser().id)}`;
 const [section,setSection]=useState<T>(()=>{const pending=take();if(pending)return pending;try{const value=sessionStorage.getItem(contextKey) as T;if(valid.includes(value))return value;}catch{}return fallback;});
 useEffect(()=>{try{sessionStorage.setItem(contextKey,section);}catch{}},[contextKey,section]);
 useEffect(()=>{const next=take();if(next)setSection(next);const handle=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.kind===kind&&valid.includes(d.value)){take();setSection(d.value);}};window.addEventListener('aethelgard:section-target',handle);return()=>window.removeEventListener('aethelgard:section-target',handle);},[kind]);
 return [section,setSection] as const;
}
export const JOURNAL_SECTIONS:readonly JournalSection[]=['quests','achievements','stats','leaderboard','premium','notifications','journal','settings'];
export const WORLD_SECTIONS:readonly WorldSection[]=['lands','dungeons','activities'];
