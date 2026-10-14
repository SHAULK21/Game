import React,{useState} from 'react';
import {useGame} from '../../context/GameContext';
import {t,useLocale} from '../../i18n/locale';
import {GameDialog} from '../navigation/GameDialog';
import {RpgIcon} from '../../interfaces/fantasy/components/ui/RpgIcon';

/** Real quest rewards, without the journal's application settings. */
export function SettlementQuestBoard({onClose}:{onClose:()=>void}){
 useLocale();
 const {quests,claimQuestReward}=useGame();
 const [showCompleted,setShowCompleted]=useState(false);
 const visible=quests.filter(q=>showCompleted?q.claimed:!q.claimed).sort((a,b)=>Number(b.completed)-Number(a.completed));
 return <GameDialog title="Доска поручений" onClose={onClose} className="settlement-board">
  <div className="settlement-board-heading"><div><RpgIcon kind="quest" size={28}/><h2>{t('Доска поручений')}</h2></div><button aria-label={t('Закрыть доску поручений')} onClick={onClose}>×</button></div>
  <div className="settlement-board-tabs"><button aria-pressed={!showCompleted} onClick={()=>setShowCompleted(false)}>{t('Поручения')}</button><button aria-pressed={showCompleted} onClick={()=>setShowCompleted(true)}>{t('Сданные поручения')}</button></div>
  <div className="settlement-board-scroll">
   {!visible.length&&<p>{t(showCompleted?'Сданных поручений пока нет.':'Все поручения сданы.')}</p>}
   {visible.map(q=><article key={q.id} className={`settlement-quest${q.completed&&!q.claimed?' settlement-quest--ready':''}`} data-quest-id={q.id}>
    <h3>{t(q.title)}</h3><p>{t(q.description)}</p>
    {!q.claimed&&<div className="settlement-quest-progress"><progress aria-label={t(q.title)} max={Math.max(1,q.targetCount)} value={Math.min(q.currentCount,q.targetCount)}/><span>{q.currentCount}/{q.targetCount}</span></div>}
    <div className="settlement-quest-rewards"><span><RpgIcon kind="gold" size={17}/>{q.rewardGold} {t('золота')}</span>{(q.rewardSilver||0)>0&&<span><RpgIcon kind="silver" size={17}/>{q.rewardSilver} {t('серебра')}</span>}<span>{q.rewardExp} {t('опыта')}</span>{q.rewardItems?.map((item,i)=><span key={`${item}:${i}`}>{t(item)}</span>)}</div>
    {q.completed&&!q.claimed?<button className="settlement-quest-claim" onClick={()=>claimQuestReward(q.id)}>{t('Забрать награду')}</button>:q.claimed?<span className="settlement-quest-state">{t('Сдано')}</span>:null}
   </article>)}
  </div>
 </GameDialog>;
}
