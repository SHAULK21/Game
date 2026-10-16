import {useGame} from '../../context/GameContext';
import {inSettlement} from '../../utils/worldPresence';
import React from 'react';
import {useInterface} from '../../context/InterfaceContext';
import {t,useLocale} from '../../i18n/locale';
import {sound} from '../../utils/audio';
import {triggerHaptic} from '../../utils/telegram';
import {RpgIcon,type RpgIconKind} from './ReferenceIcon';
import type {GameTabId} from '../../types/navigation';
export interface BottomNavigationProps {currentTab:GameTabId;onSelectTab:(tab:GameTabId)=>void;unreadChatCount?:number;availableQuestsCount?:number}
const primary:{id:GameTabId;label:string;icon:RpgIconKind}[]=[{id:'hunter',label:'Охота',icon:'hunt'},{id:'world',label:'Мир',icon:'map'},{id:'character',label:'Герой',icon:'character'},{id:'inventory',label:'Сумка',icon:'inventory'}];
export function UnifiedBottomNavigation({currentTab,onSelectTab,availableQuestsCount=0,unreadChatCount=0}:BottomNavigationProps){
 useLocale();const {player,isInCombat}=useGame();const town=inSettlement(player)&&!isInCombat;const {style}=useInterface();
 const select=(tab:GameTabId)=>{sound.playClick();triggerHaptic('light');onSelectTab(tab==='hunter'&&player?.expeditionPresence?'expeditions':tab==='hunter'&&town?'settlement':tab);};
 return <><nav aria-label={t('Основные разделы')} className={`game-nav reference-bottom-nav ${style==='modern'?'modern-reference-nav':'fantasy-shell-nav'}`}><div className="reference-nav-items">{primary.map(s=><button key={s.id} aria-current={(currentTab===s.id||s.id==='hunter'&&currentTab==='settlement')?'page':undefined} className={`game-nav-item ${(currentTab===s.id||s.id==='hunter'&&currentTab==='settlement')?'is-active':''}`} onClick={()=>select(s.id)}><RpgIcon kind={s.icon} size={25}/><span>{t(s.id==='hunter'&&player?.expeditionPresence?'Экспедиция':s.id==='hunter'&&town?'Поселение':s.label)}</span></button>)}<button aria-current={currentTab!=='settlement'&&!primary.some(s=>s.id===currentTab)?'page':undefined} className={`game-nav-item ${currentTab!=='settlement'&&!primary.some(s=>s.id===currentTab)?'is-active':''}`} onClick={()=>select('menu')}><RpgIcon kind="more" size={25}/><span>{t('Меню')}</span>{(availableQuestsCount>0||unreadChatCount>0)&&<span className="nav-dot" aria-label={t('Есть новые события')}/>}</button></div></nav></>;
}
