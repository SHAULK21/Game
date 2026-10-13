import React,{useState} from 'react';
import {useGame} from '../../context/GameContext';
import {useInterface} from '../../context/InterfaceContext';
import {t,useLocale} from '../../i18n/locale';
import {GAME_SECTION_GROUPS,requestGameSection} from '../navigation/gameSections';
import {inSettlement,worldPlace} from '../../utils/worldPresence';
import {RpgIcon,type RpgIconKind} from '../../interfaces/fantasy/components/ui/RpgIcon';
import type {JournalSection} from '../navigation/gameSections';
import type {GameTabId} from '../../types/navigation';
export function SettlementScreen({onNavigate}:{onNavigate?:(tab:GameTabId)=>void}){
 useLocale();const {player,returnToSettlement,travelState,isInCombat,isCombatEnded,activeDungeonRun}=useGame();const {style}=useInterface();const [message,setMessage]=useState('');
 if(!player)return null;
 const town=inSettlement(player);const blocked=travelState.isTraveling||Boolean(player.worldJourney)||isInCombat&&!isCombatEnded||Boolean(activeDungeonRun);
 const navigate=(tab:GameTabId)=>onNavigate?.(tab);
 return <section className={`${style==='modern'?'ui-panel':'bestiary-panel folio-page'} m-3 rounded-xl border p-4 space-y-4 pb-24`} data-settlement-screen>
  <div><h1 className="text-xl font-bold">{t('Поселение')}</h1><p className="mt-2 text-sm">{t(town?'Вы в поселении. Здесь находятся мастерские, рынок и остальные занятия.':'Сейчас вы вне поселения. Чтобы заняться ремеслом, рыбалкой или торговлей, сначала доберитесь до него.')}</p></div>
  {town&&<img src="/assets/story/courtyard.webp" alt="" className="w-full rounded-lg object-cover" style={{height:140}}/>}
 {!town?<><p className="text-sm">{t('Вы сейчас: ')}{t(worldPlace(player)==='dungeon'?'Пещера':'Поля')}</p>{activeDungeonRun&&<p role="status">{t('Сначала завершите поход или покиньте пещеру.')}</p>}<button className="rpg-button min-h-11 w-full rounded-lg border p-3" disabled={blocked} onClick={()=>{const result=returnToSettlement();setMessage(result.message);if(result.success)navigate('world');}}>{t('Идти в поселение')} · {t('без расхода энергии')}</button></>:<>
  <div className="grid grid-cols-2 gap-2"><button className="rpg-button min-h-11 rounded-lg border p-3" onClick={()=>{requestGameSection({id:'hunt',label:'Поля',icon:'map',tab:'world',world:'lands'},navigate);}}>{t('Отправиться на поля')}</button><button className="rpg-button min-h-11 rounded-lg border p-3" onClick={()=>requestGameSection({id:'dungeons',label:'Пещеры',icon:'bestiary',tab:'world',world:'dungeons'},navigate)}>{t('Отправиться в пещеру')}</button></div>
  {GAME_SECTION_GROUPS.map(group=><section key={group.label} className="space-y-2"><h2 className="font-bold">{t(group.label)}</h2><div className="grid grid-cols-2 gap-2">{group.items.filter(i=>!i.world&&i.id!=='hunt').map(item=><button key={item.id} className="min-h-11 flex items-center gap-2 rounded-lg border p-3 text-left" onClick={()=>requestGameSection(item,navigate)}><RpgIcon kind={item.icon as RpgIconKind} size={22}/>{t(item.label)}</button>)}</div></section>)}
  <div className="grid grid-cols-2 gap-2">{[{label:'Журнал приключений',section:'journal'},{label:'Статистика',section:'stats'},{label:'Оповещения',section:'notifications'},{label:'Настройки',section:'settings'},{label:'Premium',section:'premium'}].map(s=><button key={s.section} className="min-h-11 rounded-lg border p-3" onClick={()=>requestGameSection({id:s.section,label:s.label,icon:'quest',tab:'more',journal:s.section as JournalSection},navigate)}>{t(s.label)}</button>)}</div>
  </>}
  {message&&<p role="status">{t(message)}</p>}
 </section>;
}
