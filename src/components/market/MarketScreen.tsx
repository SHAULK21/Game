import React, { useEffect, useMemo, useState } from 'react';
import { Store, Coins, ShoppingCart, Plus, RefreshCw, Package, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';
import { triggerHaptic } from '../../utils/telegram';
import { calculateMarketSale } from '../../utils/marketEconomy';
import { getLeveledEquipmentName } from '../../data/gameData';
import { ClassGearBonus } from '../ui/ClassGearBonus';

type Listing = {
  id: string; seller_telegram_id: number; item_json: any; quantity: number; price_gold: number; created_at: string; display_name: string; username?: string;
};

const BASIC = [
  { id: 'pot_hp_small', name: 'Малое зелье исцеления', icon: '🧪', desc: '+120 HP', price: 35 },
  { id: 'pot_mp_small', name: 'Малое зелье маны', icon: '💧', desc: '+80 MP', price: 40 },
];

export const MarketScreen: React.FC = () => {
  const { player, premium, refreshMarketIncome, buyMarketListing, buyBasicConsumable, listMarketItem } = useGame();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'players' | 'shop'>('players');
  const [error, setError] = useState('');
  const [listingItem, setListingItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(100);

  const load = async () => {
    setLoading(true); setError('');
    try {
      await refreshMarketIncome();
      const r = await apiRequest<{ listings: Listing[] }>('/api/market/listings');
      setListings((r.listings || []).map(listing => ({ ...listing, item_json: {
        ...listing.item_json, name: getLeveledEquipmentName(listing.item_json.name, listing.item_json.type, listing.item_json.level || 1, listing.item_json.targetClass)
      } })));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить рынок.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sellable = useMemo(() => (player?.inventory || []).filter(i => !i.isEquipped && !i.isLocked && !i.boundToClan && i.type !== 'ore'), [player]);

  const buyListing = async (listing: Listing) => {
    if (!player || player.gold < listing.price_gold) { setError('Недостаточно золота.'); return; }
    if (player.inventory.length >= player.maxInventorySlots && !(player.inventory.some(i => i.templateId === listing.item_json.templateId && i.name === listing.item_json.name))) { setError('Инвентарь заполнен.'); return; }
    const r = await buyMarketListing(listing.id, listing.price_gold);
    if (!r.success) { setError(r.message); return; }
    triggerHaptic('success'); await load();
  };

  const submitListing = async () => {
    if (!listingItem) return;
    const r = await listMarketItem(listingItem, quantity, price);
    if (!r.success) setError(r.message); else { setListingItem(null); await load(); triggerHaptic('success'); }
  };

  if (!player) return null;
  const salePreview = calculateMarketSale(price, premium.active);
  return <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
    <div className="ui-panel rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-cyan-950 border border-slate-700 flex items-center justify-center"><Store className="w-6 h-6 text-[#d5ba89]" /></div><div><div className="text-[10px] text-[#d5ba89] font-mono uppercase tracking-widest">Торговая площадь</div><h2 className="font-cinzel text-lg font-bold">Рынок Аэтельгарда</h2></div></div>
        <div className="text-right"><div className="text-[9px] text-slate-500">Ваш баланс</div><div className="text-sm font-bold text-amber-300">🪙 {player.gold.toLocaleString()}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>setTab('players')} className={`py-2 rounded-xl text-xs font-bold border ${tab==='players'?'bg-cyan-950 text-[#d5ba89] border-cyan-500/40':'bg-slate-900 text-slate-400 border-slate-800'}`}>Игроки</button><button onClick={()=>setTab('shop')} className={`py-2 rounded-xl text-xs font-bold border ${tab==='shop'?'bg-amber-950 text-amber-300 border-amber-500/40':'bg-slate-900 text-slate-400 border-slate-800'}`}>Базовый магазин</button></div>
    </div>
    {error && <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs p-3">{error}</div>}
    {tab === 'players' && <p className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 text-[10px] text-amber-200">
      Налог продавца — 3% от цены проданного лота, округляется вверх до целого золота. С активным Premium — 0%. Статус проверяется при продаже; выручка поступает при открытии или обновлении рынка.
    </p>}
    {tab==='players' ? <>
      <div className="flex gap-2"><button onClick={load} className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300"><RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading?'animate-spin':''}`} /> Обновить</button><button onClick={()=>setListingItem(sellable[0]||null)} disabled={!sellable.length} className="flex-1 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-40"><Plus className="w-3.5 h-3.5 inline mr-1"/> Продать вещь</button></div>
      <div className="space-y-2">{listings.map(l=><div key={l.id} className="rounded-xl border border-slate-800 bg-[#090e18] p-3"><div className="flex gap-3"><div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl">{l.item_json.icon||'📦'}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-100 truncate">{l.item_json.name}</div><div className="text-[9px] text-slate-500">{l.item_json.rarity} · ур. {l.item_json.level||1} · ×{l.quantity}</div><ClassGearBonus item={l.item_json} characterClass={player.classId} compact /><div className="text-[9px] text-[#d5ba89] mt-1">Продавец: {l.display_name}</div></div><div className="text-right"><div className="text-sm font-bold text-amber-300">🪙 {Number(l.price_gold).toLocaleString()}</div><button onClick={()=>buyListing(l)} className="mt-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[9px] font-bold"><ShoppingCart className="w-3 h-3 inline mr-1"/>Купить</button></div></div></div>)}{!listings.length&&!loading&&<div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-600">На рынке пока нет предложений.</div>}</div>
    </> : <div className="space-y-2">{BASIC.map(x=><div key={x.id} className="rounded-xl border border-slate-800 bg-[#090e18] p-3 flex items-center gap-3"><div className="text-3xl">{x.icon}</div><div className="flex-1"><div className="text-xs font-bold">{x.name}</div><div className="text-[9px] text-slate-500">{x.desc}</div></div><button onClick={()=>{if(!buyBasicConsumable(x.id,x.price))setError('Не хватает золота или места в инвентаре.');else triggerHaptic('success')}} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-bold">🪙 {x.price}</button></div>)}</div>}
    {listingItem && <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-2"><div className="w-full max-w-lg rounded-2xl bg-[#080c15] border border-slate-700 p-4"><div className="flex justify-between"><div className="font-cinzel font-bold text-[#d5ba89]">Выставить на рынок</div><button onClick={()=>setListingItem(null)}><X className="w-5 h-5 text-slate-500"/></button></div><div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex gap-3"><span className="text-3xl">{listingItem.icon}</span><div><div className="text-xs font-bold">{listingItem.name}</div><ClassGearBonus item={listingItem} characterClass={player.classId} /><div className="text-[9px] text-slate-500">Доступно: {listingItem.stackCount||1}</div></div></div><div className="grid grid-cols-2 gap-2 mt-2"><label className="text-[9px] text-slate-500">Количество<input type="number" min="1" max={listingItem.stackCount||1} value={quantity} onChange={e=>setQuantity(Math.max(1,Number(e.target.value)||1))} className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs"/></label><label className="text-[9px] text-slate-500">Цена за лот<input type="number" min="1" value={price} onChange={e=>setPrice(Math.max(1,Number(e.target.value)||1))} className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs"/></label></div><p className="mt-2 text-[10px] text-amber-200">Налог: {salePreview.taxGold} 🪙 ({salePreview.taxPercent}%). Вы получите: {salePreview.sellerGold} 🪙{premium.active ? " · Premium без налога" : ""}.</p><button disabled={premium.loading} onClick={submitListing} className="w-full mt-3 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold">Выставить</button></div></div>}
  </div>;
};
