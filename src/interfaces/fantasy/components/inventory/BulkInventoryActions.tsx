import { t as localize, useLocale } from '../../../../i18n/locale';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { BULK_EQUIPMENT_TYPES, BULK_RARITIES, bulkReward, selectBulkItems, type BulkAction, type BulkFilters } from '../../../../utils/bulkInventory';
import type { ItemRarity } from '../../../../types/game';
import { RpgIcon } from '../ui/RpgIcon';
const TYPE_LABELS: Record<string,string> = {weapon:'Оружие',offhand:'Вторая рука',helmet:'Шлемы',armor:'Доспехи',pants:'Поножи / штаны',gloves:'Рукавицы / перчатки',boots:'Сапоги',amulet:'Амулеты',ring:'Кольца',belt:'Пояса',cloak:'Плащи',artifact:'Артефакты'};
const RARITY_LABELS: Record<ItemRarity,string> = {common:'Обычные',uncommon:'Необычные',rare:'Редкие',epic:'Эпические',legendary:'Легендарные',mythic:'Мифические',ancient:'Древние',divine:'Божественные'};
export function BulkInventoryActions() {
  useLocale();
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
  return <section className="inventory-bulk p-3 space-y-3">
    <button aria-expanded={open} onClick={()=>setOpen(!open)} className="min-h-11 w-full flex items-center justify-between gap-2 text-left text-xs font-semibold inventory-ink"><span className="flex items-center gap-2"><RpgIcon kind="crown" size={16} />{localize("Массовая продажа и разбор")}</span><span aria-hidden="true">{localize(open?'−':'+')}</span></button>
    {open && <>
      {!premium.active ? <div className="space-y-2"><p className="text-[11px] inventory-ink">{localize("С Premium можно обработать выбранные редкости и типы снаряжения одним действием.")}</p><button disabled={busy||premium.loading} onClick={async()=>{setBusy(true);try{const result=await purchasePremium();setFeedback(result.message);}finally{setBusy(false);}}} className="rpg-button rpg-button-primary px-3 py-2 text-xs inventory-ink disabled:opacity-40">{localize("Подключить Premium")}</button></div> : <>
        <div className="space-y-2"><div className="text-[11px] inventory-ink">{localize("Редкость — можно выбрать несколько")}</div><div className="flex flex-wrap gap-1.5">{BULK_RARITIES.map(rarity=><button key={rarity} disabled={busy} aria-pressed={filters.rarities.includes(rarity)} onClick={()=>changeFilters({...filters,rarities:filters.rarities.includes(rarity)?filters.rarities.filter(r=>r!==rarity):[...filters.rarities,rarity]})} className={`inventory-filter-toggle px-2 py-1.5 text-[11px] ${filters.rarities.includes(rarity)?'is-selected':''} disabled:opacity-40`}>{localize(RARITY_LABELS[rarity])}</button>)}</div></div>
        <label className="block text-[11px] inventory-ink">{localize("Тип снаряжения")}<select aria-label={localize("Тип снаряжения для массовой обработки")} disabled={busy} value={filters.type} onChange={e=>changeFilters({...filters,type:e.target.value as BulkFilters['type']})} className="inventory-bulk-select mt-1 w-full px-3 py-2 text-xs"><option value="all">{localize("Все типы снаряжения")}</option>{BULK_EQUIPMENT_TYPES.map(type=><option key={type} value={type}>{localize(TYPE_LABELS[type])}</option>)}</select></label>
        <label className="flex items-center gap-2 text-[11px] inventory-ink"><input type="checkbox" checked={filters.keepUpgraded} disabled={busy} onChange={e=>changeFilters({...filters,keepUpgraded:e.target.checked})} />{localize("Сохранить заточенные вещи (+1 и выше)")}</label>
        <p className="text-[10px] leading-relaxed inventory-ink">{localize("Экипированные, заблокированные и клановые вещи защищены. Зелья, руда и материалы в массовую обработку не входят.")}</p>
        <div className="inventory-paper-inset p-2.5 text-[11px] space-y-1"><p className="inventory-ink">{localize("Подходит: ")}{localize(sale.count)}{localize(" вещей · ")}{localize(items.length)}{localize(" слотов")}</p><p className="inventory-ink">{localize("Продажа: +")}{localize(sale.gold)}{localize(" золота")}</p><p className="inventory-ink">{localize("Разбор: +")}{localize(salvage.silver)}{localize(" серебра, +")}{localize(salvage.ore)}{localize(" железной руды")}</p></div>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy||premium.loading||!items.length} onClick={()=>setConfirmation({action:'sell',filters:{...filters,rarities:[...filters.rarities]},ids:items.map(item=>item.id)})} className="rpg-button rpg-button-primary p-2 text-xs inventory-ink disabled:opacity-40">{localize("Продать выбранное")}</button><button disabled={busy||premium.loading||!items.length} onClick={()=>setConfirmation({action:'disassemble',filters:{...filters,rarities:[...filters.rarities]},ids:items.map(item=>item.id)})} className="rpg-button rpg-button-secondary p-2 text-xs inventory-ink disabled:opacity-40">{localize("Разобрать выбранное")}</button></div>
      </>}
    </>}
    {feedback && <p role="status" className="text-[11px] leading-relaxed inventory-ink">{localize(feedback)}</p>}
    {confirmation && confirmed && <div role="dialog" aria-modal="true" aria-label={localize("Подтверждение массовой обработки")} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"><div className="inventory-item-sheet w-full max-w-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold inventory-ink">{localize(confirmation.action==='sell'?'Продать':'Разобрать')} {localize(confirmed.count)}{localize(" вещей?")}</h3>
      <p className="text-xs inventory-ink">{localize(confirmation.action==='sell'?`Вы получите ${confirmed.gold} золота.`:`Вы получите ${confirmed.silver} серебра и ${confirmed.ore} железной руды.`)}{localize(" Предметы будут удалены из инвентаря.")}</p>
      <details className="text-[11px] inventory-ink"><summary className="cursor-pointer">{localize("Показать выбранные вещи")}</summary><ul className="mt-2 max-h-40 overflow-auto space-y-1">{confirmItems.map(item=><li key={item.id}>{localize(item.name)} · {localize(RARITY_LABELS[item.rarity])}{localize(item.upgradeLevel>0?` · +${item.upgradeLevel}`:'')} · ×{localize(item.stackCount||1)}</li>)}</ul></details>
      {feedback && <p role="alert" className="text-[11px] inventory-ink">{localize(feedback)}</p>}
      <div className="flex gap-2"><button disabled={busy||!confirmed.count} onClick={submit} className="flex-1 rpg-button rpg-button-primary p-2.5 text-xs inventory-ink disabled:opacity-40">{localize(busy?'Обработка…':'Подтвердить')}</button><button disabled={busy} onClick={()=>setConfirmation(null)} className="rpg-button rpg-button-secondary p-2.5 text-xs inventory-ink disabled:opacity-40">{localize("Отмена")}</button></div>
    </div></div>}
  </section>;
}
