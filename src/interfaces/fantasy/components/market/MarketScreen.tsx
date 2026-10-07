import { ItemSelector } from '../../../../components/ui/ItemSelector';
import { ResidentSalePanel } from '../../../../components/market/ResidentSalePanel';
import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import type { ItemRarity } from '../../../../types/game';
import { STAT_LABELS } from '../../../../utils/statLabels';
import { getEffectiveGearStats } from '../../../../utils/classEquipment';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { apiRequest } from '../../../../utils/api';
import { triggerHaptic } from '../../../../utils/telegram';
import { calculateMarketSale } from '../../../../utils/marketEconomy';
import { RARITY_COLORS, getLeveledEquipmentName } from '../../data/gameData';
import { ClassGearBonus } from '../../../../components/ui/ClassGearBonus';
import { ItemArtwork } from '../ui/ItemArtwork';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ResourceBadge, RpgButton } from '../ui/BestiaryUI';

type Listing = {
  id: string; seller_telegram_id: number; item_json: any; quantity: number; price_gold: number; created_at: string; display_name: string; username?: string;
};

const BASIC = [
  { id: 'pot_hp_small', name: 'Малое зелье исцеления', desc: '+120 HP', price: 35 },
  { id: 'pot_mp_small', name: 'Малое зелье маны', desc: '+80 MP', price: 40 },
];

export const MarketScreen: React.FC = () => {
  const { locale } = useLocale();
  const { player, premium, refreshMarketIncome, buyMarketListing, buyBasicConsumable, listMarketItem, refreshServerInventory, returnMarketListing } = useGame();
  const [ownListings,setOwnListings]=useState<Listing[]>([]);
  const actionLock=useRef(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'players' | 'shop' | 'residents'>('players');
  const [error, setError] = useState('');
  const [listingOpen,setListingOpen] = useState(false);
  const [sellSearch,setSellSearch] = useState('');
  const [sellCategory,setSellCategory] = useState('all');
  const [listingItem, setListingItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('100');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      await refreshMarketIncome();
      const mine=await apiRequest<{listings:Listing[]}>('/api/market/mine');
      setOwnListings(mine.listings || []);
      await refreshServerInventory();
      const r = await apiRequest<{ listings: Listing[] }>('/api/market/listings');
      setListings((r.listings || []).map(listing => ({ ...listing, item_json: {
        ...listing.item_json, name: getLeveledEquipmentName(listing.item_json.name, listing.item_json.type, listing.item_json.level || 1, listing.item_json.targetClass)
      } })));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить рынок.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sellable = useMemo(() => (player?.inventory || []).filter(i => i.serverOwned && i.marketTradable !== false && !i.isEquipped && !i.isLocked && !i.boundToClan && !Object.values(player?.equipped || {}).some(e => e?.id === i.id)), [player]);

  const filteredSellable = useMemo(() => sellable.filter(item => {
    const equipment=['weapon','offhand','helmet','armor','pants','gloves','boots','amulet','ring','belt','cloak','artifact'];
    const matchesCategory=sellCategory==='all' || sellCategory==='equipment' && equipment.includes(item.type) || sellCategory==='resources' && ['ore','material'].includes(item.type) || sellCategory==='potions' && item.type==='potion' || sellCategory==='tools' && ['pickaxe','alchemyTool'].includes(item.type);
    return matchesCategory && [item.name, localize(item.name)].some(name => name.toLocaleLowerCase(intlLocale()).includes(sellSearch.trim().toLocaleLowerCase(intlLocale())));
  }).sort((a,b)=>localize(a.name).localeCompare(localize(b.name),intlLocale()) || b.level-a.level),[sellable,sellSearch,sellCategory,locale]);

  const buyListing = async (listing:Listing) => {
    if (actionLock.current) return;
    actionLock.current=true;setBusy(true);setError('');
    try {
      const result=await buyMarketListing(listing.id,listing.price_gold);
      if (!result.success) { setError(result.message); return; }
      triggerHaptic('success');await load();
    } finally { actionLock.current=false;setBusy(false); }
  };
  const reclaimListing = async (listing:Listing) => {
    if (actionLock.current) return;
    actionLock.current=true;setBusy(true);setError('');
    try {
      const result=await returnMarketListing(listing.id);
      if (!result.success) {setError(result.message);return;}
      await load();triggerHaptic('success');
    } finally {actionLock.current=false;setBusy(false);}
  };

  const submitListing = async () => {
    if (!listingItem || busy) return;
    const count = Number(quantity);
    const maximum = Math.min(999, listingItem.stackCount || 1);
    if (!Number.isInteger(count) || count < 1 || count > maximum) {
      setError(`Введите целое количество от 1 до ${maximum}.`);
      return;
    }
    const lotPrice = Number(price);
    if (!Number.isInteger(lotPrice) || lotPrice < 1 || lotPrice > 100000000) {
      setError('Введите целую цену от 1 до 100000000 золота.');
      return;
    }
    setBusy(true);
    const r = await listMarketItem(listingItem, count, lotPrice);
    if (!r.success) setError(r.message); else { setListingItem(null); setListingOpen(false); await load(); triggerHaptic('success'); }
    setBusy(false);
  };

  if (!player) return null;
  const salePreview = calculateMarketSale(Number(price) || 0, premium.active);
  return <FolioPage className="space-y-3 pt-3">
    <BestiaryPanel className="rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-lg border border-[#514633] bg-[#111416] text-[#b99558]"><RpgIcon kind="market" size={24} /></div><div><div className="text-[11px] text-[#d5ba89] uppercase tracking-widest">{localize("Торговая площадь")}</div><h2 className="font-cinzel text-lg font-bold">{localize("Рынок Аэтельгарда")}</h2></div></div>
        <div className="text-right"><div className="text-[11px] text-slate-500">{localize(tab==='players'?'Кошелёк рынка':'Ваш баланс')}</div><ResourceBadge kind="gold" value={(tab==='players' ? player.marketGold ?? 0 : player.gold).toLocaleString(intlLocale())} /></div>
      </div>
      <div role="tablist" className="mt-3 grid grid-cols-3 gap-2"><button role="tab" aria-selected={tab==='players'} onClick={async ()=>setTab('players')} className={`min-h-11 rounded-lg border text-xs font-bold ${tab==='players'?'border-[#9d8459] bg-[#302c24] text-[#d5ba89]':'border-slate-800 bg-slate-900 text-slate-400'}`}>{localize("Рыцари")}</button><button role="tab" aria-selected={tab==='shop'} onClick={async ()=>setTab('shop')} className={`min-h-11 rounded-lg border text-xs font-bold ${tab==='shop'?'border-[#9d8459] bg-[#302c24] text-[#d5ba89]':'border-slate-800 bg-slate-900 text-slate-400'}`}>{localize("Базовый магазин")}</button><button onClick={async ()=>setTab('residents')} className={`min-h-11 rounded-lg border px-1 text-xs font-bold ${tab==='residents'?'border-amber-600 bg-amber-950 text-amber-200':'border-slate-800 bg-slate-900 text-slate-400'}`}>{localize("Местные жители")}</button></div>
    </BestiaryPanel>
    {tab==='players' && <p className="text-xs leading-relaxed text-slate-400">{localize("Рыцари — другие игроки. На общий рынок принимаются только серверные вещи. Локальный лут продаётся местным жителям.")}</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{localize(error)}</div>}
    {tab === 'players' && <p title={localize("Налог продавца — 3%, с Premium — 0%. Оплата и выручка идут через отдельный серверный кошелёк рынка: стартовые 120 золота и доход от продаж. Золото из локального сохранения сюда не переносится. Покупки и возвраты сохраняются сервером даже при полной сумке.")} className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 text-xs text-amber-200">{localize("Налог продавца — 3%, с Premium — 0%. Оплата и выручка идут через отдельный серверный кошелёк рынка: стартовые 120 золота и доход от продаж. Золото из локального сохранения сюда не переносится. Покупки и возвраты сохраняются сервером даже при полной сумке.")}</p>}
    {tab==='players' && <div className="rounded-xl border border-amber-700/40 p-3 text-xs"><div>{localize('Кошелёк рынка')}: <b>{player.marketGold ?? '…'}</b> 🪙</div>{ownListings.length>0 && <div className="mt-3 space-y-2"><b>{localize('Мои лоты')}</b>{ownListings.map(l=><div key={l.id} className="flex items-center justify-between gap-2"><span>{localize(l.item_json.name)} ×{l.quantity}</span><button disabled={busy} onClick={async ()=>reclaimListing(l)} className="min-h-11 rounded-lg border px-3">{localize('Снять и вернуть')}</button></div>)}</div>}<p className="mt-2">{localize('Через 7 дней непроданные вещи автоматически возвращаются при открытии рынка или загрузке инвентаря.')}</p></div>}
    {tab==='residents' ? <ResidentSalePanel /> : tab==='players' ? <>
      <div className="flex gap-2"><RpgButton variant="secondary" onClick={load} className="flex-1">{localize("Обновить")}</RpgButton><RpgButton variant="primary" onClick={async ()=>{setListingOpen(true);setListingItem(null);setSellSearch('');setSellCategory('all');setQuantity('1');}} disabled={!sellable.length} className="flex-1">{localize("Продать вещь")}</RpgButton></div>
      <div className="space-y-2">{listings.map(l=><BestiaryPanel key={l.id} className="p-3"><div className="flex gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-950"><ItemArtwork item={l.item_json} size={40} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-100">{localize(l.item_json.name)}</div><div className="text-xs text-slate-500">{localize(RARITY_COLORS[l.item_json.rarity as ItemRarity]?.label || l.item_json.rarity)}{localize(" · ур. ")}{localize(l.item_json.level||1)} · ×{localize(l.quantity)}</div><ClassGearBonus item={l.item_json} characterClass={player.classId} compact />{Object.keys(l.item_json.stats||{}).length>0 && <details className="mt-1 text-xs"><summary className="min-h-11 cursor-pointer py-3 text-cyan-300">{localize("Характеристики · заточка +")}{localize(l.item_json.upgradeLevel||0)}</summary><div className="mt-1 space-y-1">{Object.entries(getEffectiveGearStats(l.item_json)).map(([key,value])=><div key={key} className="flex justify-between text-slate-400"><span>{localize(STAT_LABELS[key]||key)}</span><b className="text-slate-200">{localize(value)}</b></div>)}</div></details>}<div className="mt-1 text-xs text-[#d5ba89]">{localize("Продавец: ")}{l.display_name}</div></div><div className="text-right"><ResourceBadge kind="gold" value={Number(l.price_gold).toLocaleString(intlLocale())} /><RpgButton variant="secondary" disabled={busy || String(l.seller_telegram_id) === String(player.userId)} onClick={async ()=>buyListing(l)} className="mt-1 min-h-11 px-2.5">{localize("Купить")}</RpgButton></div></div></BestiaryPanel>)}{!listings.length&&!loading&&<BestiaryPanel className="border-dashed p-8 text-center text-xs text-slate-500">{localize("На рынке пока нет предложений.")}</BestiaryPanel>}</div>
    </> : <div className="space-y-2">{BASIC.map(x=><BestiaryPanel key={x.id} className="flex items-center gap-3 p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#514633] bg-slate-950"><RpgIcon kind="potion" size={24} className="text-[#ae9ac4]" /></span><div className="flex-1"><div className="text-xs font-bold">{localize(x.name)}</div><div className="text-xs text-slate-500">{localize(x.desc)}</div></div><RpgButton variant="secondary" onClick={async ()=>{if(!await buyBasicConsumable(x.id,x.price))setError('Не хватает золота или места в инвентаре.');else triggerHaptic('success')}} className="px-3"><RpgIcon kind="gold" size={15}/>{localize(x.price)}</RpgButton></BestiaryPanel>)}</div>}
    {listingOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-2 sm:items-center"><div role="dialog" aria-modal="true" aria-label={localize("Выставить на рынок")} className="dialog-frame max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between"><h3 className="font-cinzel font-bold text-[#d5ba89]">{localize("Выставить на рынок")}</h3><button className="rpg-icon-button" disabled={busy} aria-label={localize("Закрыть продажу")} onClick={async ()=>setListingOpen(false)}><span aria-hidden="true" className="text-xl">×</span></button></div>
      <label className="block text-xs text-slate-400">{localize("Поиск по названию")}<input aria-label={localize("Найти вещь для продажи")} type="search" value={sellSearch} disabled={busy} placeholder={localize("Например: мясо вепря")} onChange={event=>{setSellSearch(event.target.value);setListingItem(null);}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"/></label>
      <div className="flex flex-wrap gap-1.5">{[['all','Все'],['equipment','Экипировка'],['resources','Ресурсы'],['potions','Зелья'],['tools','Инструменты']].map(([id,label])=><button key={id} disabled={busy} aria-pressed={sellCategory===id} onClick={async ()=>{setSellCategory(id);setListingItem(null);}} className={`rounded-lg border px-2 py-2 text-xs ${sellCategory===id?'border-cyan-600 bg-cyan-950 text-cyan-200':'border-slate-800 text-slate-400'}`}>{localize(label)}</button>)}</div>
      <p className="text-[11px] text-slate-500">{localize("Найдено: ")}{localize(filteredSellable.length)}{localize(". Надетые, запертые и клановые вещи не продаются. Снимите экипировку, чтобы выставить её.")}</p>
      <label className="block text-xs text-slate-400">{localize("Предмет")}<ItemSelector label="Предмет для продажи" items={filteredSellable} value={listingItem?.id || ''} onSelect={id=>{setListingItem(filteredSellable.find(i=>i.id===id)||null);setQuantity('1');}} /></label>
      {listingItem && <><div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex gap-3"><ItemArtwork item={listingItem} size={44}/><div className="min-w-0"><div className="text-xs font-bold break-words">{localize(listingItem.name)}</div><ClassGearBonus item={listingItem} characterClass={player.classId}/><div className="text-[11px] text-slate-500">{localize("Ур. ")}{localize(listingItem.level)}{localize(" · Заточка +")}{localize(listingItem.upgradeLevel||0)}{localize(" · Доступно: ")}{localize(listingItem.stackCount||1)}</div><div className="mt-1 flex flex-wrap gap-1">{Object.entries(listingItem.stats||{}).map(([key,value])=><span key={key} className="text-[11px] text-cyan-200">{localize(STAT_LABELS[key]||key)}: {localize(String(value))}</span>)}</div></div></div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">{localize("Количество")}<input type="number" min="1" max={listingItem.stackCount||1} value={quantity} disabled={busy} onChange={event=>setQuantity(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-sm"/></label><label className="text-xs text-slate-500">{localize("Цена за лот")}<input type="number" min="1" value={price} disabled={busy} onChange={event=>setPrice(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-sm"/></label></div><p className="text-xs text-amber-200">{localize("Налог: ")}{localize(salePreview.taxGold)}{localize(" золота (")}{localize(salePreview.taxPercent)}{localize("%). Вы получите: ")}{localize(salePreview.sellerGold)}{localize(" золота")}{localize(premium.active?' · Premium без налога':'')}.</p></>}
      <RpgButton variant="primary" disabled={!listingItem || premium.loading || busy} onClick={submitListing} className="w-full disabled:opacity-35">{localize(busy?'Выставляем…':'Выставить')}</RpgButton>
    </div></div>}

  </FolioPage>;
};
