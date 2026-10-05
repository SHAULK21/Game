import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useInterface } from '../../context/InterfaceContext';
import { t, useLocale } from '../../i18n/locale';
import { localBuyoutGold } from '../../utils/localMarket';
import { ItemArtwork } from '../ui/ItemArtwork';
export function ResidentSalePanel() {
  useLocale();
  const { player, sellToResidents } = useGame();
  const { style } = useInterface();
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
  const gold = item && valid ? localBuyoutGold(item.sellPrice,count) : 0;
  const fantasy = style === 'fantasy';
  return <section className={`${fantasy ? 'bestiary-panel' : 'ui-panel'} rounded-xl border p-4 space-y-3`}>
    <h3 className="text-base font-bold text-amber-200">{t('Местные жители')}</h3>
    <p className="text-xs leading-relaxed text-slate-300">{t('Жители покупают сразу за 30% обычной стоимости вещи. Минимум — 1 золото за вещь с ненулевой ценой. Выберите количество и подтвердите продажу. Налога и ожидания нет.')}</p>
    <label className="block text-xs">{t('Поиск по названию')}<input type="search" value={search} disabled={busy} onChange={e=>{setSearch(e.target.value);setItemId('');setMessage('');}} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2" /></label>
    <label className="block text-xs">{t('Предмет для продажи')}<select value={item?.id || ''} disabled={busy} onChange={e=>{setItemId(e.target.value);setQuantity('1');setMessage('');}} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2"><option value="">{t('Выберите предмет')}</option>{filtered.map(i=><option key={i.id} value={i.id}>{t(i.name)} ×{i.stackCount || 1}</option>)}</select></label>
    {!filtered.length && <p className="text-xs text-slate-400">{t('Ничего не найдено')}</p>}
    {item && <><div className="flex items-center gap-3"><ItemArtwork item={item} size={48}/><span className="text-sm">{t(item.name)}</span></div><label className="block text-xs">{t('Количество')}<input type="number" min="1" max={Math.min(999,item.stackCount || 1)} value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 p-2"/></label><p className="text-sm text-amber-200">{t('Вы получите: ')}<strong>{gold}</strong> {t('золота')}</p></>}
    <button disabled={busy || !valid || gold <= 0} onClick={async()=>{
      if (!item || !valid || busy) return;
      setBusy(true);setMessage('');
      try { const result=await sellToResidents(item,count);setMessage(result.message);if(result.success){setItemId('');setQuantity('1');} }
      catch {setMessage('Не удалось продать предмет.');}
      finally {setBusy(false);}
    }} className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40 ${fantasy ? 'border-[#9d8459] bg-[#302c24] text-[#d5ba89]' : 'border-amber-600 bg-amber-950 text-amber-200'}`}>{t(busy ? 'Продаём…' : 'Подтвердить продажу жителям')}</button>
    {message && <p role="status" className="text-xs leading-relaxed">{t(message)}</p>}
  </section>;
}
