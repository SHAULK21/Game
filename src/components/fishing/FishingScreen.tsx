import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useInterface } from '../../context/InterfaceContext';
import { useNavigation } from '../../context/NavigationContext';
import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { FISH, FISHING_SPOTS, FISHING_RODS, FISHING_RECIPES, FISHING_COST, fishingPhase, fishingProgress, migrateFishing } from '../../utils/fishing';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/telegram';

export const FishingScreen: React.FC = () => {
 useLocale();
 const {player,fishingAction,isInCombat,activeDungeonRun,travelState}=useGame();
 const {style}=useInterface();const {setCurrentTab}=useNavigation();
 const [selectedSpot,setSelectedSpot]=useState('river'),[now,setNow]=useState(Date.now()),[section,setSection]=useState<'shore'|'journal'|'recipes'>('shore');
 const [feedback,setFeedback]=useState<string[]>([]);const [lastCatch,setLastCatch]=useState<{name:string;id:string;grams:number}|null>(null);
 const announced=useRef('');
 const fishing=migrateFishing(player?.fishing);const cast=fishing.cast;const phase=fishingPhase(cast,now);
 useEffect(()=>{if(cast)setSelectedSpot(cast.spotId);},[cast?.id]);
 useEffect(()=>{if(!cast)return;const timer=window.setInterval(()=>setNow(Date.now()),200);const refresh=()=>setNow(Date.now());document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};},[cast?.id]);
 useEffect(()=>{if(phase==='bite'&&cast&&announced.current!==cast.id){announced.current=cast.id;sound.playFishingBite();triggerHaptic('medium');}},[phase,cast?.id]);
 if(!player)return null;
 const fantasy=style==='fantasy';const panel=fantasy?'bestiary-panel':'ui-panel rounded-xl border border-slate-700';const button=fantasy?'rpg-button rpg-button-primary':'rounded-lg border border-amber-500/50 bg-amber-950/60 text-amber-100';
 const secondary=fantasy?'rpg-button rpg-button-secondary':'rounded-lg border border-slate-700 bg-slate-900 text-slate-200';
 const text=fantasy?'text-[#d8c9aa]':'text-slate-200';const muted=fantasy?'text-[#aaa49a]':'text-slate-400';
 const spot=FISHING_SPOTS.find(s=>s.id===(cast?.spotId||selectedSpot))||FISHING_SPOTS[0];const progress=fishingProgress(fishing);const rod=FISHING_RODS[fishing.rod];const nextRod=FISHING_RODS[fishing.rod+1];
 const busy=isInCombat||!!activeDungeonRun||travelState.isTraveling||!!player.miningExpedition;
 const act=(action:'cast'|'hook'|'land'|'cancel'|'upgrade')=>{const result=fishingAction(action,action==='cast'?selectedSpot:cast?.id);setNow(Date.now());setFeedback([result.message]);if(result.success&&result.fish)setLastCatch({name:result.fish.name,id:result.fish.templateId!.replace('fish_',''),grams:result.grams!});};
 const kilograms=(grams:number)=>(grams/1000).toLocaleString(intlLocale(),{maximumFractionDigits:2})+' '+localize('кг');
 const status=phase==='wait'?'Леска натянута. Поплавок тихо покачивается.':phase==='bite'?'Поклёвка! Поплавок ушёл под воду — подсекайте.':phase==='reel'?'Рыба сопротивляется. Подтягивайте её к берегу.':phase==='land'?'Улов у берега. Заберите рыбу в сумку.':phase==='lost'?'Рыба ушла. Смотайте леску и попробуйте снова.':'Выберите водоём и забросьте удочку.';
 return <div className={`${fantasy?'folio-page fantasy-fishing-page':'p-3'} mx-auto max-w-lg space-y-3 pt-3 pb-24 ${text}`}>
  <header className={`${panel} p-3 space-y-2`}>
   <div className="flex items-center justify-between gap-2"><h1 className="folio-title text-xl font-bold">{localize('Рыбалка')}</h1><span className="text-xs">{localize('Выносливость')} {player.stamina}/{player.maxStamina}</span></div>
   <div className={`flex flex-wrap items-center justify-between gap-2 text-xs ${muted}`}><span>{localize('Рыболов')} · {localize('Ур. ')}{fishing.level}</span><span>{localize(rod.name)}</span><span>{localize('Уловов: ')}{fishing.catches}</span></div>
   <div role="progressbar" aria-label={localize('Опыт рыбалки')} aria-valuenow={progress.current} aria-valuemax={progress.need} className="h-1.5 overflow-hidden rounded bg-black/40"><div className="h-full bg-[#a18a53]" style={{width:progress.percent+'%'}}/></div>
   <p className={`text-[11px] ${muted}`}>{fishing.level>=100?localize('Мастер рыболов'):progress.current+' / '+progress.need+' EXP'}</p>
  </header>
  <div role="tablist" aria-label={localize('Разделы рыбалки')} className="grid grid-cols-3 gap-2">{[['shore','Берег'],['journal','Журнал улова'],['recipes','Рыба и алхимия']].map(([id,label])=><button key={id} role="tab" aria-selected={section===id} className={`${section===id?button:secondary} min-h-11 px-2 text-xs`} onClick={()=>setSection(id as typeof section)}>{localize(label)}</button>)}</div>
  {section==='shore'&&<>
   <label className="block text-xs"><span className={`mb-1 block ${muted}`}>{localize('Водоём')}</span><select aria-label={localize('Водоём')} value={cast?.spotId||selectedSpot} disabled={!!cast} onChange={e=>setSelectedSpot(e.target.value)} className={`${panel} min-h-11 w-full px-3 text-sm bg-[#161b1b]`}>{FISHING_SPOTS.map(s=><option key={s.id} value={s.id} disabled={player.level<s.heroLevel||fishing.level<s.level}>{localize(s.name)}{player.level<s.heroLevel||fishing.level<s.level?' · '+localize('Герой')+' '+s.heroLevel+' / '+localize('Рыболов')+' '+s.level:''}</option>)}</select></label>
   <section className={`${panel} overflow-hidden`}>
    <div className="relative aspect-[3/2] overflow-hidden bg-[#282d25]">
     <img src="/assets/fishing/river.webp" alt={localize('Камышовый берег старой реки')} className={`h-full w-full object-cover fishing-water-${spot.id}`} />
     {cast&&<span aria-hidden="true" className={`fishing-ripple fishing-ripple-${phase} absolute left-[54%] top-[56%] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#e2c475]`} />}
     <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-3"><h2 className="text-lg font-semibold text-[#e9dfc6]">{localize(spot.name)}</h2><p className="mt-1 text-xs text-[#e9dfc6]">{localize(spot.description)}</p></div>
    </div>
    <div className="space-y-2 p-3"><p role="status" className="text-sm leading-relaxed">{localize(status)}</p>
     {phase==='bite'&&<p className={`text-xs ${muted}`}>{localize('До схода рыбы: ')}{Math.max(0,Math.ceil((cast!.expiresAt-now)/1000))}{localize(' сек.')}</p>}
     {phase==='idle'?<button disabled={busy||player.stamina<FISHING_COST} onClick={()=>act('cast')} className={`${button} min-h-12 w-full disabled:opacity-40`}>{localize('Забросить удочку')} · {FISHING_COST} {localize('выносливости')}</button>:
      <button disabled={busy||phase==='wait'||phase==='reel'} onClick={()=>act(phase==='bite'?'hook':phase==='land'?'land':'cancel')} className={`${button} min-h-12 w-full disabled:opacity-40`}>{localize(phase==='bite'?'Подсечь':phase==='land'?'Забрать улов':phase==='lost'?'Смотать леску':phase==='reel'?'Вываживание…':'Ожидание поклёвки…')}</button>}
     {cast&&phase!=='lost'&&<button disabled={busy} onClick={()=>act('cancel')} className={`${secondary} min-h-10 w-full text-xs`}>{localize('Смотать леску')}</button>}
     {busy&&<p className={`text-xs ${muted}`}>{localize('Рыбалка доступна после завершения боя, путешествия, пещеры или экспедиции.')}</p>}
    </div>
   </section>
   <section className={`${panel} p-3`}><h3 className="mb-2 text-sm font-semibold">{localize('Обитатели водоёма')}</h3><div className="grid grid-cols-3 gap-2">{spot.fish.map(id=>{const f=FISH.find(f=>f.id===id)!;return <div key={id} className="text-center"><img className="mx-auto h-16 w-full object-contain rounded" src={'/assets/fishing/'+id+'.webp'} alt=""/><p className="text-[11px] leading-snug">{localize(f.name)}</p><p className={`mt-1 text-[10px] ${muted}`}>{localize(f.rarity==='rare'?'Редкая':f.rarity==='uncommon'?'Необычная':'Обычная')}</p></div>;})}</div></section>
   <section className={`${panel} space-y-2 p-3`}><h3 className="text-sm font-semibold">{localize('Мастерская рыболова')}</h3><p className={`text-xs ${muted}`}>{localize('Улучшение удочки ускоряет поклёвку и повышает шанс редкой рыбы. Наживка входит в стоимость заброса.')}</p>{nextRod?<><p className="text-xs">{localize(nextRod.name)} · {localize('Рыболов')} {nextRod.level} · {nextRod.silver} {localize('серебра')}</p><p className={`text-xs ${muted}`}>{nextRod.ingredients.map(i=>localize(i.name)+' ×'+i.count).join(' · ')}</p><button disabled={busy||!!cast||fishing.level<nextRod.level} onClick={()=>act('upgrade')} className={`${secondary} min-h-11 w-full text-xs disabled:opacity-40`}>{localize('Улучшить удочку')}</button></>:<p className="text-xs">{localize('Удочка улучшена до максимума.')}</p>}</section>
  </>}
  {feedback.length>0&&<div role="status" className={`${panel} p-3 text-xs leading-relaxed`}>{feedback.map((line,i)=><p key={i}>{localize(line)}</p>)}{lastCatch&&<div className="mt-2 flex items-center gap-3"><img src={'/assets/fishing/'+lastCatch.id+'.webp'} alt="" className="h-12 w-16 rounded object-contain"/><span>{localize(lastCatch.name)} · {kilograms(lastCatch.grams)}</span></div>}</div>}
  {section==='journal'&&<section className={`${panel} space-y-3 p-3`}><div className="flex items-center justify-between text-xs"><h2 className="text-lg font-semibold">{localize('Журнал улова')}</h2><span>{Object.keys(fishing.collection).length} / {FISH.length}</span></div><p className={`text-xs ${muted}`}>{localize('Самый крупный улов: ')}{kilograms(fishing.recordGrams)}</p><div className="grid grid-cols-2 gap-3">{FISH.map(f=>{const record=fishing.collection[f.id];return <article key={f.id} className={`border-b border-[#776344]/40 pb-2 ${record?'':'opacity-50'}`}><img src={'/assets/fishing/'+f.id+'.webp'} alt="" className="mx-auto h-20 w-full object-contain rounded"/><h3 className="text-xs font-semibold">{localize(f.name)}</h3><p className={`mt-1 text-[11px] ${muted}`}>{record?localize('Поймано: ')+record.count+' · '+kilograms(record.recordGrams):localize('Ещё не поймана')}</p></article>;})}</div></section>}
  {section==='recipes'&&<section className={`${panel} space-y-3 p-3`}><h2 className="text-lg font-semibold">{localize('Улов для алхимика')}</h2><p className={`text-xs ${muted}`}>{localize('Рыба хранится в сумке как материал. Варите из неё особые зелья в алхимии или продавайте лишний улов.')}</p>{FISHING_RECIPES.map(r=><article key={r.id} className="space-y-1 border-b border-[#776344]/40 pb-3"><h3 className="text-sm font-semibold">{localize(r.name)}</h3><p className="text-xs leading-relaxed">{localize(r.description)}</p><p className={`text-[11px] ${muted}`}>{localize('Алхимия: ур. ')}{r.levelReq} · {localize('Герой: ур. ')}{r.heroLevelReq}</p><p className={`text-[11px] ${muted}`}>{r.ingredients.map(i=>localize(i.name)+' ×'+i.count).join(' · ')}</p></article>)}<button onClick={()=>setCurrentTab('alchemy')} className={`${button} min-h-11 w-full text-sm`}>{localize('Перейти в алхимию')}</button></section>}
 </div>;
};
