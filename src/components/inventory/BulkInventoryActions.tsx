import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { BULK_EQUIPMENT_TYPES, BULK_RARITIES, bulkReward, selectBulkItems, type BulkAction, type BulkFilters } from '../../utils/bulkInventory';
import type { ItemRarity } from '../../types/game';
import { RpgIcon } from '../ui/RpgIcon';
const TYPE_LABELS: Record<string,string> = {weapon:'Оружие',offhand:'Вторая рука',helmet:'Шлемы',armor:'Доспехи',pants:'Поножи / штаны',gloves:'Рукавицы / перчатки',boots:'Сапоги',amulet:'Амулеты',ring:'Кольца',belt:'Пояса',cloak:'Плащи',artifact:'Артефакты'};
const RARITY_LABELS: Record<ItemRarity,string> = {common:'Обычные',uncommon:'Необычные',rare:'Редкие',epic:'Эпические',legendary:'Легендарные',mythic:'Мифические',ancient:'Древние',divine:'Божественные'};
export function BulkInventoryActions() {
  const {player,premium,bulkDisposeItems,purchasePremium} = useGame();
  const [open,setOpen] = useState(false);
  const [filters,setFilters] = useState<BulkFilters>({rarities:['common'],type:'all',keepUpgraded:true});
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState('');
  const [confirmation,setConfirmation] = useState<{action:BulkAction;filters:BulkFilters;ids:string[]} | null>(null);
  if (!player) return null;
  const items = selectBulkItems(player,filters);
  const sale = bulkReward(items,'sell');
  const salvage = bulkReward(items,'disassemble');
  const confirmItems = confirmation ? selectBulkItems(player,confirmation.filters).filter(item=>confirmation.ids.includes(item.id)) : [];
  const confirmed = confirmation ? bulkReward(confirmItems,confirmation.action) : null;
  const changeFilters = (next:BulkFilters) => {setFilters(next);setFeedback('');setConfirmation(null);};
  const submit = async () => {
    if (!confirmation || busy) return;
    setBusy(true);setFeedback('');
    try {
      const result = await bulkDisposeItems(confirmation.filters,confirmation.action,confirmation.ids);
      setFeedback(result.message);
      if (result.success) setConfirmation(null);
    } finally {setBusy(false);}
  };
  return <section className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 space-y-3">
    <button aria-expanded={open} onClick={()=>setOpen(!open)} className="min-h-11 w-full flex items-center justify-between gap-2 text-left text-xs font-semibold text-amber-200"><span className="flex items-center gap-2"><RpgIcon kind="crown" size={16} />Массовая продажа и разбор</span><span aria-hidden="true">{open?'−':'+'}</span></button>
    {open && <>
      {!premium.active ? <div className="space-y-2"><p className="text-[11px] text-slate-400">С Premium можно обработать выбранные редкости и типы снаряжения одним действием.</p><button disabled={busy||premium.loading} onClick={async()=>{setBusy(true);try{const result=await purchasePremium();setFeedback(result.message);}finally{setBusy(false);}}} className="rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 disabled:opacity-40">Подключить Premium</button></div> : <>
        <div className="space-y-2"><div className="text-[11px] text-slate-400">Редкость — можно выбрать несколько</div><div className="flex flex-wrap gap-1.5">{BULK_RARITIES.map(rarity=><button key={rarity} disabled={busy} aria-pressed={filters.rarities.includes(rarity)} onClick={()=>changeFilters({...filters,rarities:filters.rarities.includes(rarity)?filters.rarities.filter(r=>r!==rarity):[...filters.rarities,rarity]})} className={`rounded-lg border px-2 py-1.5 text-[10px] ${filters.rarities.includes(rarity)?'border-amber-700 bg-amber-950/40 text-amber-100':'border-slate-800 text-slate-500'} disabled:opacity-40`}>{RARITY_LABELS[rarity]}</button>)}</div></div>
        <label className="block text-[11px] text-slate-400">Тип снаряжения<select aria-label="Тип снаряжения для массовой обработки" disabled={busy} value={filters.type} onChange={e=>changeFilters({...filters,type:e.target.value as BulkFilters['type']})} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="all">Все типы снаряжения</option>{BULK_EQUIPMENT_TYPES.map(type=><option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label>
        <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={filters.keepUpgraded} disabled={busy} onChange={e=>changeFilters({...filters,keepUpgraded:e.target.checked})} />Сохранить заточенные вещи (+1 и выше)</label>
        <p className="text-[10px] leading-relaxed text-slate-500">Экипированные, заблокированные и клановые вещи защищены. Зелья, руда и материалы в массовую обработку не входят.</p>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px] space-y-1"><p className="text-slate-200">Подходит: {sale.count} вещей · {items.length} слотов</p><p className="text-amber-200">Продажа: +{sale.gold} золота</p><p className="text-slate-400">Разбор: +{salvage.silver} серебра, +{salvage.ore} железной руды</p></div>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy||premium.loading||!items.length} onClick={()=>setConfirmation({action:'sell',filters:{...filters,rarities:[...filters.rarities]},ids:items.map(item=>item.id)})} className="rounded-lg border border-amber-700 bg-amber-950/40 p-2 text-xs text-amber-100 disabled:opacity-40">Продать выбранное</button><button disabled={busy||premium.loading||!items.length} onClick={()=>setConfirmation({action:'disassemble',filters:{...filters,rarities:[...filters.rarities]},ids:items.map(item=>item.id)})} className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-xs text-slate-200 disabled:opacity-40">Разобрать выбранное</button></div>
      </>}
    </>}
    {feedback && <p role="status" className="text-[11px] leading-relaxed text-amber-200">{feedback}</p>}
    {confirmation && confirmed && <div role="dialog" aria-modal="true" aria-label="Подтверждение массовой обработки" className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0c1018] p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">{confirmation.action==='sell'?'Продать':'Разобрать'} {confirmed.count} вещей?</h3>
      <p className="text-xs text-slate-400">{confirmation.action==='sell'?`Вы получите ${confirmed.gold} золота.`:`Вы получите ${confirmed.silver} серебра и ${confirmed.ore} железной руды.`} Предметы будут удалены из инвентаря.</p>
      <details className="text-[11px] text-slate-400"><summary className="cursor-pointer">Показать выбранные вещи</summary><ul className="mt-2 max-h-40 overflow-auto space-y-1">{confirmItems.map(item=><li key={item.id}>{item.name} · {RARITY_LABELS[item.rarity]}{item.upgradeLevel>0?` · +${item.upgradeLevel}`:''} · ×{item.stackCount||1}</li>)}</ul></details>
      {feedback && <p role="alert" className="text-[11px] text-amber-200">{feedback}</p>}
      <div className="flex gap-2"><button disabled={busy||!confirmed.count} onClick={submit} className="flex-1 rounded-lg border border-amber-700 bg-amber-950/40 p-2.5 text-xs text-amber-100 disabled:opacity-40">{busy?'Обработка…':'Подтвердить'}</button><button disabled={busy} onClick={()=>setConfirmation(null)} className="rounded-lg border border-slate-700 p-2.5 text-xs text-slate-400 disabled:opacity-40">Отмена</button></div>
    </div></div>}
  </section>;
}
