import React,{useState} from 'react';
import {useGame} from '../../context/GameContext';
import {useInterface} from '../../context/InterfaceContext';
import {t,useLocale} from '../../i18n/locale';
import {requestGameSection} from '../navigation/gameSections';
import {inSettlement,worldPlace} from '../../utils/worldPresence';
import {RpgIcon,type RpgIconKind} from '../../interfaces/fantasy/components/ui/RpgIcon';
import type {GameTabId} from '../../types/navigation';
import {SettlementQuestBoard} from './SettlementQuestBoard';

interface Place { id:string; label:string; description:string; icon:RpgIconKind; tab?:GameTabId }
// A settlement has places, not the complete application navigation catalogue.
const groups:{id:string;label:string;places:Place[]}[]=[
 {id:'workshops',label:'Мастерский квартал',places:[
  {id:'crafting',label:'Мастерская',description:'Создание оружия и снаряжения',icon:'weapon',tab:'crafting'},
  {id:'blacksmith',label:'Кузница',description:'Заточка и улучшение снаряжения',icon:'forge',tab:'blacksmith'},
  {id:'alchemy',label:'Лавка алхимика',description:'Зелья и алхимические инструменты',icon:'alchemy',tab:'alchemy'},
 ]},
 {id:'people',label:'Места встречи',places:[
  {id:'arena',label:'Арена',description:'Гладиаторы, поединки и вознесение',icon:'arena',tab:'arena'},
  {id:'clan',label:'Дом клана',description:'Собраться со своим кланом',icon:'clan',tab:'clan'},
  {id:'pets',label:'Приют спутников',description:'Спутники и их создание',icon:'pet',tab:'pets'},
  {id:'chat',label:'Таверна',description:'Общение с другими искателями',icon:'quest',tab:'chat'},
 ]},
 {id:'outskirts',label:'У поселения',places:[
  {id:'fishing',label:'Рыбацкий причал',description:'Рыбалка и снасти',icon:'fish',tab:'fishing'},
  {id:'mine',label:'Шахтёрский двор',description:'Добыча руды и экспедиции',icon:'mine',tab:'mine'},
 ]},
];

export function SettlementScreen({onNavigate}:{onNavigate?:(tab:GameTabId)=>void}){
 useLocale();
 const {player,quests,returnToSettlement,travelState,isInCombat,isCombatEnded,activeDungeonRun}=useGame();
 const {style}=useInterface();
 const [message,setMessage]=useState('');
 const [boardOpen,setBoardOpen]=useState(false);
 if(!player)return null;
 const town=inSettlement(player);
 const blockedReason=travelState.isTraveling||player.worldJourney?'Вы в пути. Дождитесь прибытия.':activeDungeonRun?'Сначала завершите поход или покиньте пещеру.':isInCombat&&!isCombatEnded?'Сначала завершите текущий бой.':'';
 const rewardsReady=quests.filter(q=>q.completed&&!q.claimed).length;
 const navigate=(tab:GameTabId)=>onNavigate?.(tab);
 const Title=style==='fantasy-beta'?'h2':'h1';
 const placeCard=(place:Place,featured=false)=><button key={place.id} className={`settlement-place${featured?' settlement-place--featured':''}`} data-settlement-place={place.id} onClick={()=>{if(place.id==='quests')setBoardOpen(true);else if(place.tab)navigate(place.tab);}}>
  <span className="settlement-place-icon"><RpgIcon kind={place.icon} size={32}/></span>
  <span className="settlement-place-copy"><strong>{t(place.label)}</strong><small>{t(place.description)}</small>{place.id==='quests'&&rewardsReady>0&&<span className="settlement-reward-badge">{t('Наград к получению: {0}').replace('{0}',String(rewardsReady))}</span>}</span>
  <span className="settlement-place-arrow" aria-hidden="true">›</span>
 </button>;
 return <section className="settlement-plaza" data-settlement-screen>
  <div className="settlement-overview">
   <div className="settlement-scene"><img src="/assets/story/courtyard.webp" alt="" decoding="async"/><span className="settlement-presence"><RpgIcon kind="map" size={16}/>{t(town?'Вы в поселении':'За воротами поселения')}</span></div>
   <div className="settlement-introduction"><Title>{t(town?'Площадь поселения':'Дорога в поселение')}</Title><p>{t(town?'Торговые ряды, мастерские и новые поручения. Выберите, к кому заглянуть.':'Мастерские и торговцы ждут за городскими воротами. Сначала доберитесь до поселения.')}</p></div>
  </div>
  {!town?<div className="settlement-arrival">
   <p>{t('Вы сейчас: ')}<strong>{t(worldPlace(player)==='dungeon'?'Пещера':'Поля')}</strong></p>
   {blockedReason&&<p role="status">{t(blockedReason)}</p>}
   <button className="settlement-road settlement-road--primary" disabled={Boolean(blockedReason)} onClick={()=>{const result=returnToSettlement();setMessage(result.message);if(result.success)navigate('world');}}><RpgIcon kind="map" size={25}/><span><strong>{t('Идти в поселение')}</strong><small>{t('без расхода энергии')}</small></span><span aria-hidden="true">›</span></button>
   {activeDungeonRun&&<button className="settlement-return" onClick={()=>navigate('world')}>{t('Вернуться к походу')}</button>}
  </div>:<>
   <div className="settlement-featured" aria-label={t('На площади')}>
    {placeCard({id:'market',label:'Торговые ряды',description:'Рынок и продажа местным жителям',icon:'market',tab:'market'},true)}
    {placeCard({id:'quests',label:'Доска поручений',description:'Задания жителей и поручения короля',icon:'quest'},true)}
   </div>
   {groups.map(group=><section key={group.id} className="settlement-quarter" aria-labelledby={`settlement-${group.id}`}><h2 id={`settlement-${group.id}`}><span>{t(group.label)}</span><span aria-hidden="true"/></h2><div className={`settlement-place-grid settlement-place-grid--${group.id}`}>{group.places.map(place=>placeCard(place))}</div></section>)}
   <section className="settlement-departures" aria-labelledby="settlement-gates"><h2 id="settlement-gates">{t('За городские ворота')}</h2><p>{t('Выберите землю или пещеру. В путь отправитесь после выбора маршрута.')}</p><div className="settlement-roads">
    <button className="settlement-road" onClick={()=>requestGameSection({id:'hunt',label:'Поля',icon:'map',tab:'world',world:'lands'},navigate)}><RpgIcon kind="hunt" size={27}/><span><strong>{t('Отправиться на поля')}</strong><small>{t('Выбрать землю и режим охоты')}</small></span><span aria-hidden="true">›</span></button>
    <button className="settlement-road" onClick={()=>requestGameSection({id:'dungeons',label:'Пещеры',icon:'bestiary',tab:'world',world:'dungeons'},navigate)}><RpgIcon kind="bestiary" size={27}/><span><strong>{t('Отправиться в пещеру')}</strong><small>{t('Выбрать пещеру и сложность')}</small></span><span aria-hidden="true">›</span></button>
   </div></section>
  </>}
  {message&&<p className="settlement-feedback" role="status">{t(message)}</p>}
  {boardOpen&&town&&<SettlementQuestBoard onClose={()=>setBoardOpen(false)}/>}
 </section>;
}
