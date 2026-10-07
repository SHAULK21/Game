import React, {useRef, useState} from 'react';
import {useGame} from '../../context/GameContext';
import {useInterface} from '../../context/InterfaceContext';
import {t, useLocale, intlLocale} from '../../i18n/locale';
import {PICKAXES, getPickaxeBonus} from '../../utils/mining';
import {ItemArtwork} from '../ui/ItemArtwork';

/** Buying and equipping are separate actions; show ownership beside every offer. */
export function PickaxePanel({isMining, onFeedback}:{isMining:boolean;onFeedback:(message:string)=>void}) {
  useLocale();
  const {player,buyPickaxe,equipItem,unequipItem}=useGame();
  const {style}=useInterface();
  const [feedback,setFeedback]=useState<{success:boolean;message:string}|null>(null);
  const [pending,setPending]=useState(false);
  const actionLock=useRef(false);
  if(!player)return null;
  const installed=player.equipped.pickaxe;
  const installedBonus=getPickaxeBonus(installed);
  const bagTools=player.inventory.filter(item=>item.type==='pickaxe');
  const button=style==='modern'?'rounded-lg border border-slate-600 px-3 text-cyan-200':'rpg-button rpg-button-secondary px-3';
  const busy=isMining||pending;
  const act=async(action:()=>{success:boolean;message:string}|Promise<{success:boolean;message:string}>)=>{
    if(actionLock.current)return;
    actionLock.current=true;setPending(true);
    try{const result=await action();setFeedback(result);onFeedback(result.message);}
    catch(error){const result={success:false,message:error instanceof Error?error.message:'Не удалось выполнить действие.'};setFeedback(result);onFeedback(result.message);}
    finally{actionLock.current=false;setPending(false);}
  };
  return <div className="pickaxe-panel space-y-3" data-pickaxe-status={installed?'installed':bagTools.length?'owned':'missing'}>
    <h3 className="text-sm font-bold">{t('Кирка для шахты')}</h3>
    <p className="text-xs">{t('Ваше золото: ')}<strong>{player.gold.toLocaleString(intlLocale())}</strong></p>
    {installed?<div className="rounded-lg border border-emerald-600/60 p-3 space-y-2">
      <p className="text-sm font-bold">{t('Установлена: ')}{t(installed.name)}</p>
      <div className="flex items-center gap-3"><ItemArtwork item={installed} size={46}/><div className="flex-1 text-xs">
        <p>{installedBonus?t('Бонус кирки действует'):t('Бонус этой кирки не распознан')}</p>
        <p>+{installedBonus?.critBonus||0}{t(' п.п. крита · +')}{installedBonus?.expBonus||0}{t('% опыта')}</p>
      </div><button className={`${button} min-h-11 text-xs disabled:opacity-40`} disabled={busy||player.inventory.length>=player.maxInventorySlots} onClick={async ()=>void act(()=>unequipItem('pickaxe'))}>{t('Снять')}</button></div>
      {player.inventory.length>=player.maxInventorySlots&&<p className="text-xs">{t('Чтобы снять кирку, освободите место в сумке.')}</p>}
    </div>:<p className="rounded-lg border border-amber-600/50 p-3 text-sm font-semibold">{t(bagTools.length?'Кирка куплена, но не установлена. Нажмите «Экипировать».':'Кирка не куплена. Выберите её в магазине ниже.')}</p>}
    {bagTools.map(item=><div key={item.id} className="rounded-lg border border-slate-600/40 p-2">
      <div className="flex items-center gap-2"><ItemArtwork item={item} size={36}/><div className="flex-1 text-xs"><b>{t(item.name)}</b><p>{t('Куплена · в сумке')}</p></div><button className={`${button} min-h-11 text-xs disabled:opacity-40`} disabled={busy} onClick={async ()=>void act(()=>equipItem(item))}>{t('Экипировать')}</button></div>
    </div>)}
    {feedback&&<p role={feedback.success?'status':'alert'} className="rounded-lg border border-slate-500/50 p-3 text-sm font-semibold">{t(feedback.message)}</p>}
    <p className="text-xs">{t('Отдельный слот. Бонусы работают при ручной добыче. Максимум жилы — редкий крит; обычная добыча зависит от жилы.')}</p>
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{t('Купить кирку · 5 редкостей')}</summary>
      <div className="space-y-3">{PICKAXES.map(offer=>{
        const equipped=installedBonus?.id===offer.id;
        const owned=bagTools.find(item=>getPickaxeBonus(item)?.id===offer.id);
        const reason=player.miningLevel<offer.miningLevel?`Нужен ${offer.miningLevel} уровень шахты.`:player.gold<offer.price?`Не хватает золота: нужно ${offer.price}, у вас ${player.gold}.`:player.inventory.length>=player.maxInventorySlots?'Освободите место в сумке.':null;
        return <article key={offer.id} data-pickaxe-offer={offer.id} className="rounded-lg border border-slate-600/40 p-3 space-y-2">
          <b className="text-sm">{t(offer.name)}</b>
          <p className="text-xs">{t('Шахта ')}{offer.miningLevel}{t(' ур. · +')}{offer.critBonus}{t(' п.п. крита · +')}{offer.expBonus}{t('% опыта')}</p>
          <p className="text-xs">{t('Цена: ')}{offer.price.toLocaleString(intlLocale())}{t(' золота')}</p>
          <p className="text-xs font-semibold">{t(equipped?'Установлена · бонус действует':owned?'Куплена · в сумке':'Не куплена')}</p>
          {!equipped&&!owned&&reason&&<p className="text-xs">{t(reason)}</p>}
          <button className={`${button} min-h-11 w-full text-xs disabled:opacity-50`} disabled={busy||equipped||!owned&&!!reason} onClick={async ()=>void act(async()=>owned?equipItem(owned):await buyPickaxe(offer.id))}>{t(equipped?'Установлена':owned?'Установить':`Купить · ${offer.price.toLocaleString(intlLocale())} золота`)}</button>
        </article>;
      })}</div>
    </details>
  </div>;
}
