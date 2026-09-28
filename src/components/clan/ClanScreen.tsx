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
  username?: string;
};

export const ClanScreen: React.FC = () => {
  const { player } = useGame();
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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await apiRequest<{ clan: Clan | null; members?: Member[]; messages?: ClanMessage[] }>('/api/clan/me');
      setClan(me.clan);
      setMembers(me.members || []);
      setMessages(me.messages || []);
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || action) return;
    setAction(true);
    try {
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
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-[#0b1324] to-[#07090e] p-4">
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
                  <span className="text-[10px] font-mono font-bold text-cyan-400">[{clan.tag}]</span>
                  <h3 className="font-cinzel text-base font-bold text-slate-100">{clan.name}</h3>
                  {clan.role === 'owner' && <Crown className="w-4 h-4 text-amber-300" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{clan.description || 'У клана пока нет описания.'}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-cyan-300">Ур. {clan.level}</div>
                <div className="text-[9px] text-slate-500">{clan.xp.toLocaleString()} XP</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <Users className="w-3.5 h-3.5 mx-auto text-cyan-400" />
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
                  <span className={`text-[8px] font-bold ${member.role === 'owner' ? 'text-amber-300' : member.role === 'officer' ? 'text-cyan-300' : 'text-slate-500'}`}>
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
                  <div className="text-[9px] font-bold text-cyan-300">{message.display_name}</div>
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
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-500/20 flex items-center justify-center font-mono text-[9px] font-bold text-cyan-300">[{c.tag}]</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-cinzel text-xs font-bold text-slate-100">{c.name}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Ур. {c.level} · {c.members_count}/{c.max_members}</div>
                    <div className="text-[9px] text-slate-400 mt-1 line-clamp-2">{c.description || 'Без описания'}</div>
                  </div>
                  <button onClick={() => joinClan(c.id)} disabled={action || c.members_count >= c.max_members} className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold disabled:opacity-40 flex items-center gap-1">
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
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#080c15] p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-cyan-300">Создать клан</h3>
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
