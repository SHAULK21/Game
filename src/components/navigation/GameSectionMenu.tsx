import React,{useState} from 'react';
import {t,useLocale} from '../../i18n/locale';
import {getTelegramUser} from '../../utils/telegram';
import {RpgIcon,type RpgIconKind} from '../../interfaces/fantasy/components/ui/RpgIcon';
import {GameDialog} from './GameDialog';
import {GAME_SECTION_GROUPS,ALL_GAME_SECTIONS,requestGameSection,type GameSection} from './gameSections';
import type {GameTabId} from '../../types/navigation';
export function GameSectionMenu({onClose,onSelectTab,availableQuestsCount=0,unreadChatCount=0}: {onClose:()=>void;onSelectTab:(tab:GameTabId)=>void;availableQuestsCount?:number;unreadChatCount?:number}){
 useLocale();const key=`aethelgard_favorite_sections_${getTelegramUser().id}`;
 const [favorites,setFavorites]=useState<string[]>(()=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(v))return [...new Set(v.filter(id=>ALL_GAME_SECTIONS.some(s=>s.id===id)))].slice(0,3);}catch{}return ['mine','alchemy','market'];});
 const choose=(s:GameSection)=>{onClose();requestGameSection(s,onSelectTab);};
 const pin=(id:string)=>setFavorites(before=>{const next=before.includes(id)?before.filter(x=>x!==id):[...before.slice(-2),id];try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;});
 const count=(id:string)=>id==='quests'?availableQuestsCount:id==='chat'?unreadChatCount:0;
 return <GameDialog title="Меню" onClose={onClose} className="mechanics-menu">
  <header className="mechanics-heading"><div><h1>{t('Меню')}</h1><p>{t('Все занятия под рукой')}</p></div><button className="reference-close" aria-label={t('Закрыть меню')} onClick={onClose}>×</button></header>
  <div className="mechanics-menu-scroll"><section className="mechanics-favorites"><h2>{t('Избранное')}</h2><div>{favorites.map(id=>{const s=ALL_GAME_SECTIONS.find(s=>s.id===id)!;return <button key={id} onClick={()=>choose(s)}><RpgIcon kind={s.icon as RpgIconKind} size={24}/><span>{t(s.label)}</span></button>;})}</div><p>{t('Звёздочка закрепляет раздел. До трёх избранных.')}</p></section>
  {GAME_SECTION_GROUPS.map(group=><section className="mechanics-group" key={group.label}><header><h2>{t(group.label)}</h2><p>{t(group.hint)}</p></header><div className="mechanics-grid">{group.items.map(s=><div className="mechanics-entry" key={s.id}><button onClick={()=>choose(s)}><RpgIcon kind={s.icon as RpgIconKind} size={25}/><span>{t(s.label)}</span>{count(s.id)>0&&<b className="mechanics-badge">{count(s.id)>99?'99+':count(s.id)}</b>}<span aria-hidden="true">›</span></button><button className="mechanics-pin" aria-label={t(favorites.includes(s.id)?'Убрать из избранного: {0}':'В избранное: {0}').replace('{0}',t(s.label))} aria-pressed={favorites.includes(s.id)} onClick={()=>pin(s.id)}>{favorites.includes(s.id)?'★':'☆'}</button></div>)}</div></section>)}
  <footer className="mechanics-utilities"><button onClick={()=>choose({id:'settings',label:'Настройки',icon:'settings',tab:'more',journal:'settings'})}><RpgIcon kind="settings" size={22}/>{t('Настройки')}</button><button onClick={()=>choose({id:'premium',label:'Premium',icon:'crown',tab:'more',journal:'premium'})}><RpgIcon kind="crown" size={22}/>Premium</button></footer></div>
 </GameDialog>;
}
