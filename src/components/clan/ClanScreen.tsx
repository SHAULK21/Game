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
  raid_name: string;
  raid_hp: number;
  raid_max_hp: number;
  raid_reset_at: string;
  role?: 'owner' | 'officer' | 'member';
};

type Member = {
  telegram_id: number;
  display_name: string;
  username?: string;
  role: 'owner' | 'officer' | 'member';
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
  const { player, refreshServerInventory } = useGame();
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
    await apiRequest('/api/clan/create', {
      method: 'POST',
      body: JSON.stringify({ name, tag, description })
    });
    setShowCreate(false);
    setName('');
    setTag('');
    setDescription('');
  });

  const joinClan = (id: string) => run(() => apiRequest('/api/clan/' + id + '/join', { method: 'POST' }));

  const leaveClan = () => {
    if (!window.confirm('Выйти из клана?')) return;
    run(() => apiRequest('/api/clan/leave', { method: 'POST' }));
  };

  const attackRaid = () => run(() => apiRequest('/api/clan/raid/attack', { method: 'POST', body: '{}' }));

  const moveItem = (item: StoredItem, action: 'deposit' | 'withdraw') => run(() =>
    apiRequest(`/api/clan/storage/${encodeURIComponent(item.id)}/${action}`, {
      method: 'POST', body: JSON.stringify({ quantity: item.quantity })
    })
  );
  const disposeStored = (action: 'sell' | 'disassemble', itemId?: string, upToRarity?: string) => {
    if (!window.confirm(`Обработать ${itemId ? 'выбранную вещь' : `все вещи до редкости ${upToRarity}`} в хранилище?`)) return;
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
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Социальная система</div>
              <h2 className="font-cinzel text-lg font-bold text-slate-100">Кланы</h2>
            </div>
          </div>
          <button onClick={load} disabled={loading || action} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-xs text-slate-500">Загрузка кланов…</div>
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
                <p className="text-[10px] text-slate-400 mt-1">{clan.description || 'У клана пока нет описания.'}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-[#d5ba89]">Ур. {clan.level}</div>
                <div className="text-[9px] text-slate-500">{clan.xp.toLocaleString()} XP</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Users className="w-3.5 h-3.5 mx-auto text-[#d5ba89]" />
                <div className="text-xs font-bold mt-1">{clan.members_count}/{clan.max_members}</div>
                <div className="text-[8px] text-slate-500">участники</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Coins className="w-3.5 h-3.5 mx-auto text-amber-400" />
                <div className="text-xs font-bold mt-1">{Number(clan.treasury_gold).toLocaleString()}</div>
                <div className="text-[8px] text-slate-500">казна</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Trophy className="w-3.5 h-3.5 mx-auto text-purple-400" />
                <div className="text-xs font-bold mt-1">+{Math.min(30, clan.level * 2)}%</div>
                <div className="text-[8px] text-slate-500">клановый бонус</div>
              </div>
            </div>

            <button
              onClick={leaveClan}
              disabled={action || clan.role === 'owner'}
              className="mt-3 w-full py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 text-[10px] font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> {clan.role === 'owner' ? 'Передайте руководство, чтобы выйти' : 'Выйти из клана'}
            </button>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-[#0c0d1c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] text-purple-400 font-mono uppercase">Еженедельный рейд</div>
                <h3 className="font-cinzel text-sm font-bold text-slate-100 mt-0.5">{clan.raid_name}</h3>
              </div>
              <button onClick={attackRaid} disabled={action || clan.raid_hp <= 0} className="px-3 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-bold disabled:opacity-40 flex items-center gap-1">
                <Swords className="w-3.5 h-3.5" /> Удар
              </button>
            </div>
            <div className="mt-3 flex justify-between text-[10px] font-mono">
              <span className="text-purple-300">HP босса</span>
              <span>{Number(clan.raid_hp).toLocaleString()} / {Number(clan.raid_max_hp).toLocaleString()}</span>
            </div>
            <div className="h-3 mt-1 rounded-full bg-slate-950 overflow-hidden border border-purple-950">
              <div className="h-full bg-gradient-to-r from-purple-600 to-rose-500 transition-all" style={{ width: `${Math.max(0, Number(clan.raid_hp) / Number(clan.raid_max_hp) * 100)}%` }} />
            </div>
            <div className="text-[9px] text-slate-500 mt-2">Урон рассчитывается сервером — клиент не может подменить значение.</div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-[#0d111b] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-amber-200">🏦 Хранилище клана</h3>
              <span className="text-[10px] text-slate-400">{storedItems.length} вещей</span>
            </div>
            <div className="text-[10px] text-slate-400">Вносить можно вещи с подтверждённым сервером происхождением. Старые локальные трофеи остаются личными.</div>
            <div className="text-[10px] text-amber-300">Казна: {Number(clan.treasury_gold || 0)} 🪙 · {Number((clan as Clan & { treasury_silver?: number }).treasury_silver || 0)} 🥈 · {Number((clan as Clan & { treasury_ore?: number }).treasury_ore || 0)} руды</div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              <div className="text-[10px] uppercase text-slate-500">Мои серверные вещи</div>
              {personalItems.filter(i => !i.locked && !i.equipped_slot && (!i.bound_clan_id || i.bound_clan_id === clan.id)).map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs">
                  <span>{item.item_json.icon}</span><span className="flex-1 truncate">{item.item_json.name} ×{item.quantity}</span>
                  <button disabled={action} onClick={() => moveItem(item, 'deposit')} className="text-amber-300 disabled:opacity-40">Положить</button>
                </div>
              ))}
              {!personalItems.length && <div className="text-[10px] text-slate-600">Серверных вещей пока нет. Первое участие в рейде выдаёт личный предмет раз в неделю.</div>}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              <div className="text-[10px] uppercase text-slate-500">Общие вещи</div>
              {storedItems.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-2 flex items-center gap-2 text-xs">
                  <span>{item.item_json.icon}</span>
                  <span className="flex-1 truncate">{item.item_json.name} ×{item.quantity} · {item.item_json.rarity}</span>
                  {clan.role !== 'member' && <div className="flex gap-2 text-[10px]">
                    <button disabled={action} onClick={() => moveItem(item, 'withdraw')} className="text-[#d5ba89]">Забрать</button>
                    <button disabled={action} onClick={() => disposeStored('sell', item.id)} className="text-amber-300">Продать</button>
                    <button disabled={action} onClick={() => disposeStored('disassemble', item.id)} className="text-violet-300">Разобрать</button>
                  </div>}
                </div>
              ))}
              {!storedItems.length && <div className="text-[10px] text-slate-600">Хранилище пусто.</div>}
            </div>
            {clan.role !== 'member' && storedItems.length > 0 && <div className="flex flex-wrap gap-2 items-center text-[10px]">
              <span className="text-slate-400">До редкости:</span>
              <select value={bulkRarity} onChange={e => setBulkRarity(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1 text-slate-200">
                {['common','uncommon','rare','epic','legendary','mythic','ancient','divine'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button disabled={action} onClick={() => disposeStored('sell', undefined, bulkRarity)} className="text-amber-300">Продать пачкой</button>
              <button disabled={action} onClick={() => disposeStored('disassemble', undefined, bulkRarity)} className="text-violet-300">Разобрать пачкой</button>
            </div>}
            {storageEvents.length > 0 && <div className="border-t border-slate-800 pt-2 space-y-1 max-h-24 overflow-y-auto text-[9px] text-slate-500">
              {storageEvents.map((event, index) => <div key={index}>{event.display_name}: {event.action} · {event.item_name} ×{event.quantity}</div>)}
            </div>}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cinzel text-xs font-bold text-slate-200">Участники</h3>
              <span className="text-[9px] text-slate-500">{members.length} игроков</span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {members.map(member => (
                <div key={member.telegram_id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-900">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs">⚔️</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-slate-200 truncate">{member.display_name}</div>
                    <div className="text-[8px] text-slate-500">@{member.username || 'игрок'}</div>
                  </div>
                  <span className={`text-[8px] font-bold ${member.role === 'owner' ? 'text-amber-300' : member.role === 'officer' ? 'text-[#d5ba89]' : 'text-slate-500'}`}>
                    {member.role === 'owner' ? 'ГЛАВА' : member.role === 'officer' ? 'ОФИЦЕР' : 'УЧАСТНИК'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cinzel text-xs font-bold text-slate-200">Клановый чат</h3>
              <span className="text-[9px] text-slate-500">серверный</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-auto mb-2">
              {messages.length ? messages.map(message => (
                <div key={message.id} className="p-2 rounded-lg bg-slate-950 border border-slate-900">
                  <div className="text-[9px] font-bold text-[#d5ba89]">{message.display_name}</div>
                  <div className="text-[10px] text-slate-300 mt-0.5 break-words">{message.text}</div>
                </div>
              )) : (
                <div className="p-5 text-center text-[10px] text-slate-600">Чат пока пуст.</div>
              )}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={500} placeholder="Написать клану…" className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-500" />
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
              <Plus className="w-4 h-4" /> Создать клан
            </button>
            <button onClick={load} className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5">
              <Search className="w-4 h-4" /> Обновить список
            </button>
          </div>

          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название или тег…" className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" />
          </div>

          <div className="space-y-2">
            {visibleClans.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-[#090e18] p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-slate-700 flex items-center justify-center font-mono text-[9px] font-bold text-[#d5ba89]">[{c.tag}]</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-cinzel text-xs font-bold text-slate-100">{c.name}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Ур. {c.level} · {c.members_count}/{c.max_members}</div>
                    <div className="text-[9px] text-slate-400 mt-1 line-clamp-2">{c.description || 'Без описания'}</div>
                  </div>
                  <button onClick={() => joinClan(c.id)} disabled={action || c.members_count >= c.max_members} className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-slate-700 text-[#d5ba89] text-[9px] font-bold disabled:opacity-40 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> Вступить
                  </button>
                </div>
              </div>
            ))}
            {!visibleClans.length && <div className="p-8 text-center text-xs text-slate-600">Кланы не найдены.</div>}
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#080c15] p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-[#d5ba89]">Создать клан</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-2 mt-3">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Название клана" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500" />
              <input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={6} placeholder="Тег, например NEXUS" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs font-mono outline-none focus:border-cyan-500" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={280} placeholder="Описание и правила клана" rows={3} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs outline-none focus:border-cyan-500 resize-none" />
              <button onClick={createClan} disabled={action || name.trim().length < 3 || tag.trim().length < 2} className="w-full py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-40">
                {action ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
