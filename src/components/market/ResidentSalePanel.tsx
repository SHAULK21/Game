import {apiRequest} from '../../utils/api';
import { ItemSelector } from '../ui/ItemSelector';
import { SelectionField } from '../ui/SelectionField';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../context/GameStateContext';
import { useInterface } from '../../context/InterfaceContext';
import { t, useLocale } from '../../i18n/locale';
import { localBuyoutGold, residentDemand, residentCategory, residentUnitGold } from '../../utils/localMarket';
import { ItemArtwork } from '../ui/ItemArtwork';
export function ResidentSalePanel() {
  useLocale();
  const { player, sellToResidents } = useGame();
  const { style } = useInterface();
  const [day,setDay] = useState('');
  const [priceLoading,setPriceLoading] = useState(true);
  const [priceError,setPriceError] = useState('');
  const priceRequest=useRef(0);
  const loadDemand=useCallback(async()=>{
    const request=++priceRequest.current;setPriceLoading(true);
    try{const response=await apiRequest<{day:string}>('/api/market/residents/demand');if(typeof response.day!=='string')throw new Error('Invalid demand');residentDemand(response.day);if(request===priceRequest.current){setDay(response.day);setPriceError('');}}
    catch{if(request===priceRequest.current)setPriceError('Не удалось загрузить цены жителей.');}
    finally{if(request===priceRequest.current)setPriceLoading(false);}
  },[]);
  useEffect(()=>{void loadDemand();const timer=setInterval(()=>void loadDemand(),60000);const focus=()=>void loadDemand();const visible=()=>{if(document.visibilityState==='visible')void loadDemand();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);return()=>{++priceRequest.current;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);};},[loadDemand]);
  const demand=day?residentDemand(day):null;
  const pricesReady=!!demand&&!priceLoading&&!priceError;
  const [itemId,setItemId] = useState('');
  const [quantity,setQuantity] = useState('1');
  const [search,setSearch] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const items = useMemo(() => (player?.inventory || []).filter(i => !i.isEquipped && !i.isLocked && !i.boundToClan && !Object.values(player?.equipped || {}).some(e => e?.id === i.id)), [player]);
  const filtered = items.filter(i => t(i.name).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const item = filtered.find(i => i.id === itemId);
  const count = Number(quantity);
  const valid = !!item && Number.isInteger(count) && count > 0 && count <= Math.min(999,item.stackCount || 1);
  const gold = item && valid && pricesReady ? localBuyoutGold(item,count,day) : 0;
  const fantasy = style !== 'modern';
  return <section className={`${fantasy ? 'bestiary-panel' : 'ui-panel'} rounded-xl border p-4 space-y-3`}>
    <h3 className="text-base font-bold text-amber-200">{t('Местные жители')}</h3>
    <p className="text-xs leading-relaxed text-slate-300">{t('Жители покупают сразу. Цена зависит от сегодняшнего спроса, стоимости, уровня и редкости вещи. Спрос обновляется в полночь по Киеву. Налога и ожидания нет.')}</p>
    {demand&&<div className="grid grid-cols-2 gap-2 text-xs">{demand.categories.map(c=><div key={c.id} className={`rounded-lg border p-2 ${c.percent>100?'border-amber-600 text-amber-200':'border-slate-600 text-slate-300'}`}><strong>{t(c.label)}</strong> · {t(c.percent>100?'Повышенный спрос':c.percent<100?'Низкий спрос':'Обычный спрос')} · {c.percent}%</div>)}</div>}
    {priceLoading&&<p role="status" className="text-xs">{t('Загрузка цен жителей…')}</p>}
    {priceError&&<><p role="alert" className="text-xs text-red-300">{t(priceError)}</p><button onClick={()=>void loadDemand()} className="min-h-11">{t('Обновить цены')}</button></>}
    <label className="block text-xs">{t('Поиск по названию')}<input type="search" value={search} disabled={busy} onChange={e=>{setSearch(e.target.value);setItemId('');setMessage('');}} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
    <label className="block text-xs">{t('Предмет для продажи')}{style==='modern'?<ItemSelector label="Предмет для продажи" items={filtered} value={item?.id||''} disabled={busy} onSelect={id=>{setItemId(id);setQuantity('1');setMessage('');}}/>:<SelectionField value={item?.id || ''} disabled={busy} onChange={e=>{setItemId(e.target.value);setQuantity('1');setMessage('');}} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2"><option value="">{t('Выберите предмет')}</option>{filtered.map(i=><option key={i.id} value={i.id}>{t(i.name)} ×{i.stackCount || 1}</option>)}</SelectionField>}</label>
    {!filtered.length && <p className="text-xs text-slate-400">{t('Ничего не найдено')}</p>}
    {item && <><div className="flex items-center gap-3"><ItemArtwork item={item} size={48}/><span className="text-sm">{t(item.name)}</span></div><label className="block text-xs">{t('Количество')}<input type="number" min="1" max={Math.min(999,item.stackCount || 1)} value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2"/></label>{pricesReady&&<p className="text-xs text-slate-300">{t('Цена за штуку')} · {residentUnitGold(item,day)} {t('золота')} · {t(demand!.categories.find(c=>c.id===residentCategory(item))!.label)}</p>}<p className="text-sm text-amber-200">{t('Вы получите: ')}<strong>{gold}</strong> {t('золота')}</p></>}
    <button disabled={busy || !pricesReady || !valid || gold <= 0} onClick={async()=>{
      if (!item || !valid || busy || !pricesReady) return;
      setBusy(true);setMessage('');
      try { const result=await sellToResidents(item,count,day);setMessage(result.message);if(result.success){setItemId('');setQuantity('1');}else{void loadDemand();} }
      catch {setMessage('Не удалось продать предмет.');}
      finally {setBusy(false);}
    }} className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40 ${fantasy ? 'border-[#9d8459] bg-[#302c24] text-[#d5ba89]' : 'border-amber-600 bg-amber-950 text-amber-200'}`}>{t(busy ? 'Продаём…' : 'Подтвердить продажу жителям')}</button>
    {message && <p role="status" className="text-xs leading-relaxed">{t(message)}</p>}
  </section>;
}
