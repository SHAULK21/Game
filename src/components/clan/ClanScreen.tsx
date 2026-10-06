import { SelectionField } from '../ui/SelectionField';
import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { CLAN_PROJECTS, clanProjectCost, clanRaidReward, type ClanProject } from '../../utils/clanProjects';
import { createOperationId } from '../../utils/operationId';
import { clanCreationCost } from '../../utils/clanEconomy';
import {ClanManagement} from './ClanManagement';
import {CLAN_ROLE_LABELS,canUseVault,type ClanRole} from '../../utils/clanRoles';
import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Users, Swords, Crown, LogIn, LogOut, Plus,
  RefreshCw, Send, UserPlus, Search, Trophy, Coins, X
} from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { useGame } from '../../context/GameContext';
import { triggerHaptic } from '../../utils/telegram';

type Clan = {
  id: string;
  tag: string;
  name: string;
  description: string;
  level: number;
  xp: number;
  max_members: number;
  members_count: number;
  treasury_gold: number;
  projects?: Partial<Record<ClanProject, number>>;
  raid_name: string;
  raid_hp: number;
  raid_max_hp: number;
  raid_reset_at: string;
  role?: ClanRole;
  recruitment_open?: boolean;
  min_join_level?: number;
};

type Member = {
  telegram_id: number;
  display_name: string;
  username?: string;
  role: ClanRole;
  raid_damage?: number;
  joined_at: string;
};

type ClanMessage = {
  id: number;
  text: string;
  created_at: string;
  display_name: string;
};

type StoredItem = {
  id: string;
  item_json: { name: string; icon: string; rarity: string; level: number };
  quantity: number;
  locked?: boolean;
  bound_clan_id?: string | null;
  equipped_slot?: string | null;
};
type StorageEvent = { action: string; item_name: string; quantity: number; display_name: string; created_at: string };

export const ClanScreen: React.FC = () => {
  useLocale();
  const { player, createClan: createPaidClan, premium, refreshServerInventory } = useGame();
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [chatText, setChatText] = useState('');
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [personalItems, setPersonalItems] = useState<StoredItem[]>([]);
  const [storageEvents, setStorageEvents] = useState<StorageEvent[]>([]);
  const [recipients,setRecipients] = useState<Record<string,string>>({});
  const [bulkRarity, setBulkRarity] = useState('common');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await apiRequest<{ clan: Clan | null; members?: Member[]; messages?: ClanMessage[] }>('/api/clan/me');
      setClan(me.clan);
      setMembers(me.members || []);
      setMessages(me.messages || []);
      if (me.clan) {
        const storage = await apiRequest<{ stored: StoredItem[]; personal: StoredItem[]; events: StorageEvent[] }>('/api/clan/storage');
        setStoredItems(storage.stored);
        setPersonalItems(storage.personal);
        setStorageEvents(storage.events);
      } else {
        setStoredItems([]); setPersonalItems([]); setStorageEvents([]);
      }
      if (!me.clan) {
        const list = await apiRequest<{ clans: Clan[] }>('/api/clans');
        setClans(list.clans);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить клан.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setAction(true);
    setError('');
    try {
      await fn();
      await refreshServerInventory();
      triggerHaptic('success');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка операции.');
      triggerHaptic('error');
    } finally {
      setAction(false);
    }
  };

  const createClan = () => run(async () => {
    await createPaidClan({name,tag,description});
    setShowCreate(false);
    setName('');
    setTag('');
    setDescription('');
  });

  const joinClan = (id: string) => run(() => apiRequest('/api/clan/' + id + '/join', { method: 'POST' }));

  const leaveClan = () => {
    const confirmDisband=clan?.role === 'owner' && members.length <= 1;
    const message=clan?.role === 'owner' ? confirmDisband ? 'Распустить клан и выйти? Вы последний участник. Казна и клановый склад будут удалены. Стоимость создания не возвращается.' : 'Выйти из клана? Руководство автоматически перейдёт старшему участнику: сначала офицеру. Стоимость создания не возвращается.' : 'Выйти из клана?';
    if (!window.confirm(localize(message))) return;
    run(() => apiRequest('/api/clan/leave', { method: 'POST', body:JSON.stringify({confirmDisband}) }));
  };

  const attackRaid = () => run(() => apiRequest('/api/clan/raid/attack', { method: 'POST', body: '{}' }));

  const moveItem = (item: StoredItem, action: 'deposit' | 'withdraw') => run(() =>
    apiRequest(`/api/clan/storage/${encodeURIComponent(item.id)}/${action}`, {
      method: 'POST', body: JSON.stringify({ quantity: item.quantity })
    })
  );
  const disposeStored = (action: 'sell' | 'disassemble', itemId?: string, upToRarity?: string) => {
    if (!window.confirm(localize(`Обработать ${itemId ? 'выбранную вещь' : `все вещи до редкости ${upToRarity}`} в хранилище?`))) return;
    run(() => apiRequest('/api/clan/storage/dispose', { method: 'POST', body: JSON.stringify({ action, itemId, upToRarity }) }));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || action) return;
    setAction(true);
    try {
      if (player) await apiRequest('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({ characterName: player.name, level: player.level, arenaRating: player.arenaRating })
      });
      const result = await apiRequest<{ message: ClanMessage }>('/api/clan/chat', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      setMessages(prev => [...prev, result.message]);
      setChatText('');
      triggerHaptic('light');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение.');
    } finally {
      setAction(false);
    }
  };

  const visibleClans = clans.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase())
  );

  if (!player) return null;

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24">
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-950/70 border border-blue-400/40 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">{localize("Социальная система")}</div>
              <h2 className="font-cinzel text-lg font-bold text-slate-100">{localize("Кланы")}</h2>
            </div>
          </div>
          <button onClick={load} disabled={loading || action} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
          {localize(error)}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-xs text-slate-500">{localize("Загрузка кланов…")}</div>
      ) : clan ? (
        <>
          <div className="rounded-2xl border border-cyan-500/25 bg-[#0a101d] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-[#d5ba89]">[{clan.tag}]</span>
                  <h3 className="font-cinzel text-base font-bold text-slate-100">{clan.name}</h3>
                  {clan.role === 'owner' && <Crown className="w-4 h-4 text-amber-300" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{clan.description || localize('У клана пока нет описания.')}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-[#d5ba89]">{localize("Ур. ")}{localize(clan.level)}</div>
                <div className="text-[9px] text-slate-500">{localize(clan.xp.toLocaleString(intlLocale()))} XP</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Users className="w-3.5 h-3.5 mx-auto text-[#d5ba89]" />
                <div className="text-xs font-bold mt-1">{localize(clan.members_count)}/{localize(clan.max_members)}</div>
                <div className="text-[8px] text-slate-500">{localize("участники")}</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Coins className="w-3.5 h-3.5 mx-auto text-amber-400" />
                <div className="text-xs font-bold mt-1">{localize(Number(clan.treasury_gold).toLocaleString(intlLocale()))}</div>
                <div className="text-[8px] text-slate-500">{localize("казна")}</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Trophy className="w-3.5 h-3.5 mx-auto text-purple-400" />
                <div className="text-xs font-bold mt-1">{localize(clan.max_members)}{localize(" мест")}</div>
                <div className="text-[8px] text-slate-500">{localize("вместимость")}</div>
              </div>
            </div>

            <button
              onClick={leaveClan}
              disabled={action}
              className="mt-3 w-full py-2 rounded-xl border border-slate-800 bg-rose-950/30 text-rose-300 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />{localize(" Выйти из клана")}</button>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-[#0c0d1c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] text-purple-400 font-mono uppercase">{localize("Еженедельный рейд")}</div>
                <h3 className="font-cinzel text-sm font-bold text-slate-100 mt-0.5">{localize(clan.raid_name)}</h3>
              </div>
              <button onClick={attackRaid} disabled={action || clan.raid_hp <= 0 && new Date(clan.raid_reset_at).getTime() > Date.now()} className="px-3 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-bold disabled:opacity-40 flex items-center gap-1">
                <Swords className="w-3.5 h-3.5" />{localize(" Удар")}</button>
            </div>
            <div className="mt-3 flex justify-between text-[10px] font-mono">
              <span className="text-purple-300">{localize("HP босса")}</span>
              <span>{localize(Number(clan.raid_hp).toLocaleString(intlLocale()))} / {localize(Number(clan.raid_max_hp).toLocaleString(intlLocale()))}</span>
            </div>
            <div className="h-3 mt-1 rounded-full bg-slate-950 overflow-hidden border border-purple-950">
              <div className="h-full bg-gradient-to-r from-purple-600 to-rose-500 transition-all" style={{ width: `${Math.max(0, Number(clan.raid_hp) / Number(clan.raid_max_hp) * 100)}%` }} />
            </div>
            <div className="text-[9px] text-slate-500 mt-2">{localize("Один удар в сутки. Победа: +")}{localize(clanRaidReward(clan.level, clan.projects?.research).xp)}{localize(" XP клана и +")}{localize(clanRaidReward(clan.level, clan.projects?.research).gold)}{localize(" золота в казну. Новый рейд усиливается с уровнем клана.")}</div>
          </div>

          <section className="rounded-xl border border-cyan-800 p-3 space-y-2">
            <h3 className="text-sm text-cyan-200">{localize("Клановые проекты")}</h3>
            {(Object.keys(CLAN_PROJECTS) as ClanProject[]).map(project => {
              const level=clan.projects?.[project] || 0, cost=clanProjectCost(level);
              return <div key={project} className="rounded border border-slate-800 p-2 text-xs">
                <b>{localize(CLAN_PROJECTS[project].name)} · {localize(level)}/10</b><p className="text-slate-400">{localize(CLAN_PROJECTS[project].description)}</p>
                <button disabled={action || level>=10 || !['owner','officer'].includes(clan.role || '')} onClick={()=>run(async()=>{
                  const key=`clan_project_${clan.id}_${project}`;
                  const id=localStorage.getItem(key) || createOperationId();localStorage.setItem(key,id);
                  await apiRequest('/api/clan/projects/upgrade',{method:'POST',body:JSON.stringify({project,operationId:id})});
                  localStorage.removeItem(key);
                })} className="mt-2 rounded bg-cyan-950 p-2 disabled:opacity-40">{localize(level>=10?'Максимум':`Улучшить · ${cost.gold} золота · ${cost.silver} серебра · ${cost.ore} руды`)}</button>
              </div>;
            })}
          </section>

          <div className="rounded-2xl border border-amber-500/30 bg-[#0d111b] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-amber-200">{localize("🏦 Хранилище клана")}</h3>
              <span className="text-[10px] text-slate-400">{localize(storedItems.length)}{localize(" вещей")}</span>
            </div>
            <div className="text-[10px] text-slate-400">{localize("Вносить можно вещи с подтверждённым сервером происхождением. Старые локальные трофеи остаются личными.")}</div>
            <div className="text-[10px] text-amber-300">{localize("Казна: ")}{localize(Number(clan.treasury_gold || 0))} 🪙 · {localize(Number((clan as Clan & { treasury_silver?: number }).treasury_silver || 0))} 🥈 · {localize(Number((clan as Clan & { treasury_ore?: number }).treasury_ore || 0))}{localize(" руды")}</div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              <div className="text-[10px] uppercase text-slate-500">{localize("Мои серверные вещи")}</div>
              {personalItems.filter(i => !i.locked && !i.equipped_slot && (!i.bound_clan_id || i.bound_clan_id === clan.id)).map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs">
                  <span>{localize(item.item_json.icon)}</span><span className="flex-1 truncate">{localize(item.item_json.name)} ×{localize(item.quantity)}</span>
                  <button disabled={action} onClick={() => moveItem(item, 'deposit')} className="text-amber-300 disabled:opacity-40">{localize("Положить")}</button>
                </div>
              ))}
              {!personalItems.length && <div className="text-[10px] text-slate-600">{localize("Серверных вещей пока нет. Первое участие в рейде выдаёт личный предмет раз в неделю.")}</div>}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              <div className="text-[10px] uppercase text-slate-500">{localize("Общие вещи")}</div>
              {storedItems.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-2 flex items-center gap-2 text-xs">
                  <span>{localize(item.item_json.icon)}</span>
                  <span className="flex-1 truncate">{localize(item.item_json.name)} ×{localize(item.quantity)} · {localize(item.item_json.rarity)}</span>
                  {canUseVault(clan.role || '') && <div className="flex flex-wrap gap-2 text-[10px]">
                    <button disabled={action} onClick={() => moveItem(item, 'withdraw')} className="text-[#d5ba89]">{localize("Забрать")}</button>
                    <SelectionField aria-label={localize(`Получатель ${item.item_json.name}`)} value={recipients[item.id]||''} disabled={action} onChange={e=>setRecipients(prev=>({...prev,[item.id]:e.target.value}))} className="bg-slate-950 rounded w-20"><option value="">{localize("Кому?")}</option>{members.map(m=><option key={m.telegram_id} value={m.telegram_id}>{m.display_name}</option>)}</SelectionField>
                    <button disabled={action||!recipients[item.id]} onClick={()=>run(()=>apiRequest(`/api/clan/storage/${item.id}/give`,{method:'POST',body:JSON.stringify({targetId:recipients[item.id]})}))} className="text-emerald-300 disabled:opacity-40">{localize("Выдать")}</button>
                    <button disabled={action} onClick={() => disposeStored('sell', item.id)} className="text-amber-300">{localize("Продать")}</button>
                    <button disabled={action} onClick={() => disposeStored('disassemble', item.id)} className="text-violet-300">{localize("Разобрать")}</button>
                  </div>}
                </div>
              ))}
              {!storedItems.length && <div className="text-[10px] text-slate-600">{localize("Хранилище пусто.")}</div>}
            </div>
            {canUseVault(clan.role || '') && storedItems.length > 0 && <div className="flex flex-wrap gap-2 items-center text-[10px]">
              <span className="text-slate-400">{localize("До редкости:")}</span>
              <SelectionField aria-label={localize("Редкость")} value={bulkRarity} onChange={e => setBulkRarity(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1 text-slate-200">
                {['common','uncommon','rare','epic','legendary','mythic','ancient','divine'].map(r => <option key={r} value={r}>{localize(r)}</option>)}
              </SelectionField>
              <button disabled={action} onClick={() => disposeStored('sell', undefined, bulkRarity)} className="text-amber-300">{localize("Продать пачкой")}</button>
              <button disabled={action} onClick={() => disposeStored('disassemble', undefined, bulkRarity)} className="text-violet-300">{localize("Разобрать пачкой")}</button>
            </div>}
            {storageEvents.length > 0 && <div className="border-t border-slate-800 pt-2 space-y-1 max-h-24 overflow-y-auto text-[9px] text-slate-500">
              {storageEvents.map((event, index) => <div key={index}>{event.display_name}: {localize(event.action)} · {localize(event.item_name)} ×{localize(event.quantity)}</div>)}
            </div>}
          </div>

          <ClanManagement clan={clan} members={members} busy={action} run={run} />

          <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cinzel text-xs font-bold text-slate-200">{localize("Клановый чат")}</h3>
              <span className="text-[9px] text-slate-500">{localize("серверный")}</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-auto mb-2">
              {messages.length ? messages.map(message => (
                <div key={message.id} className="p-2 rounded-lg bg-slate-950 border border-slate-900">
                  <div className="text-[9px] font-bold text-[#d5ba89]">{message.display_name}</div>
                  <div className="text-[10px] text-slate-300 mt-0.5 break-words">{message.text}</div>
                </div>
              )) : (
                <div className="p-5 text-center text-[10px] text-slate-600">{localize("Чат пока пуст.")}</div>
              )}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={500} placeholder={localize("Написать клану…")} className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-500" />
              <button disabled={action || !chatText.trim()} className="p-2 rounded-xl bg-cyan-600 text-white disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowCreate(true)} className="py-3 rounded-xl bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />{localize(" Создать клан")}</button>
            <button onClick={load} className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5">
              <Search className="w-4 h-4" />{localize(" Обновить список")}</button>
          </div>

          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={localize("Название или тег…")} className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" />
          </div>

          <div className="space-y-2">
            {visibleClans.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-[#090e18] p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-slate-700 flex items-center justify-center font-mono text-[9px] font-bold text-[#d5ba89]">[{c.tag}]</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-cinzel text-xs font-bold text-slate-100">{c.name}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{localize("Ур. ")}{localize(c.level)} · {localize(c.members_count)}/{localize(c.max_members)}</div>
                    <div className="text-[9px] text-slate-400 mt-1 line-clamp-2">{c.description || localize('Без описания')}</div>
                  </div>
                  <button onClick={() => joinClan(c.id)} disabled={action || c.members_count >= c.max_members || c.recruitment_open === false || player.level < (c.min_join_level || 1)} className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-slate-700 text-[#d5ba89] text-[9px] font-bold disabled:opacity-40 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> {localize(c.recruitment_open === false ? 'Набор закрыт' : player.level < (c.min_join_level || 1) ? `С ур. ${c.min_join_level}` : 'Вступить')}
                  </button>
                </div>
              </div>
            ))}
            {!visibleClans.length && <div className="p-8 text-center text-xs text-slate-600">{localize("Кланы не найдены.")}</div>}
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#080c15] p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-[#d5ba89]">{localize("Создать клан")}</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-2 mt-3">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder={localize("Название клана")} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" />
              <input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={6} placeholder={localize("Тег, например NEXUS")} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs font-mono outline-none focus:border-cyan-500" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={280} placeholder={localize("Описание и правила клана")} rows={3} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500 resize-none" />
              <p className="text-xs text-amber-200">{localize("Стоимость: ")}{localize(clanCreationCost(premium.active).toLocaleString(intlLocale()))} 🪙{localize(premium.active ? ' · Скидка Premium 50%' : ' · С Premium — 50 000 🪙')}{localize(". Ваш баланс: ")}{localize(player.gold.toLocaleString(intlLocale()))} 🪙.</p>
              <button onClick={createClan} disabled={action || premium.loading || name.trim().length < 3 || tag.trim().length < 2} className="w-full py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-40">
                {localize(action ? 'Создание…' : `Создать за ${clanCreationCost(premium.active).toLocaleString(intlLocale())} 🪙`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
