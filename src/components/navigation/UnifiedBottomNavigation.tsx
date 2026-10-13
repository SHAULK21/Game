import React,{useState} from 'react';
import {useInterface} from '../../context/InterfaceContext';
import {t,useLocale} from '../../i18n/locale';
import {sound} from '../../utils/audio';
import {triggerHaptic} from '../../utils/telegram';
import {RpgIcon,type RpgIconKind} from '../../interfaces/fantasy/components/ui/RpgIcon';
import {GameSectionMenu} from './GameSectionMenu';
import type {GameTabId} from '../../types/navigation';
export interface BottomNavigationProps {currentTab:GameTabId;onSelectTab:(tab:GameTabId)=>void;unreadChatCount?:number;availableQuestsCount?:number}
const primary:{id:GameTabId;label:string;icon:RpgIconKind}[]=[{id:'hunter',label:'Охота',icon:'hunt'},{id:'world',label:'Мир',icon:'map'},{id:'character',label:'Герой',icon:'character'},{id:'inventory',label:'Сумка',icon:'inventory'}];
export function UnifiedBottomNavigation({currentTab,onSelectTab,availableQuestsCount=0,unreadChatCount=0}:BottomNavigationProps){
 useLocale();const {style}=useInterface();const [open,setOpen]=useState(false);
 const select=(tab:GameTabId)=>{sound.playClick();triggerHaptic('light');setOpen(false);onSelectTab(tab);};
 return <><nav aria-label={t('Основные разделы')} className={`game-nav reference-bottom-nav ${style==='modern'?'modern-reference-nav':'fantasy-shell-nav'}`}><div className="reference-nav-items">{primary.map(s=><button key={s.id} aria-current={!open&&currentTab===s.id?'page':undefined} className={`game-nav-item ${!open&&currentTab===s.id?'is-active':''}`} onClick={()=>select(s.id)}><RpgIcon kind={s.icon} size={25}/><span>{t(s.label)}</span></button>)}<button aria-haspopup="dialog" aria-expanded={open} aria-current={open||!primary.some(s=>s.id===currentTab)?'page':undefined} className={`game-nav-item ${open||!primary.some(s=>s.id===currentTab)?'is-active':''}`} onClick={()=>{sound.playClick();triggerHaptic('light');setOpen(v=>!v);}}><RpgIcon kind="more" size={25}/><span>{t('Меню')}</span>{(availableQuestsCount>0||unreadChatCount>0)&&<span className="nav-dot" aria-label={t('Есть новые события')}/>}</button></div></nav>{open&&<GameSectionMenu onClose={()=>setOpen(false)} onSelectTab={select} availableQuestsCount={availableQuestsCount} unreadChatCount={unreadChatCount}/>}</>;
}
