import React, { useEffect, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';
import { triggerHaptic } from '../../utils/telegram';

type GlobalMessage = { id: number; text: string; created_at: string; display_name: string; username?: string };

export const ChatScreen: React.FC = () => {
  const { player } = useGame();
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try { const r = await apiRequest<{ messages: GlobalMessage[] }>('/api/chat/global'); setMessages(r.messages || []); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось подключиться к общему чату.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const t=setInterval(load,5000); return ()=>clearInterval(t); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const text=input.trim(); if(!text||sending)return;
    setSending(true);
    try { const r=await apiRequest<{message:GlobalMessage}>('/api/chat/global',{method:'POST',body:JSON.stringify({text})}); setMessages(prev=>[...prev,r.message].slice(-80)); setInput(''); triggerHaptic('light'); }
    catch(e){setError(e instanceof Error?e.message:'Не удалось отправить сообщение.');}
    finally{setSending(false);}
  };
  if(!player)return null;
  return <div className="p-3 max-w-lg mx-auto pb-24 h-[calc(100dvh-120px)] flex flex-col gap-3">
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#111025] to-[#080a12] p-4"><div className="text-[10px] text-purple-300 font-mono uppercase tracking-widest">Социальный центр</div><div className="flex items-center justify-between mt-1"><h2 className="font-cinzel text-lg font-bold">Общий чат</h2><button onClick={load} className="p-2 rounded-lg bg-slate-900 border border-slate-800"><RefreshCw className={`w-4 h-4 text-slate-400 ${loading?'animate-spin':''}`}/></button></div><div className="text-[9px] text-slate-500 mt-1">Живой серверный канал · сообщения видят все игроки</div></div>
    {error&&<div className="rounded-xl bg-rose-950/30 border border-rose-500/30 p-2 text-[10px] text-rose-200">{error}</div>}
    <div className="flex-1 overflow-y-auto space-y-2 pr-1">{messages.map(m=>{const me=m.display_name===player.name;return <div key={m.id} className={`p-2.5 rounded-xl border ${me?'ml-5 bg-cyan-950/30 border-cyan-500/30':'bg-[#0a0f1d] border-slate-800'}`}><div className="flex justify-between gap-2"><span className={`text-[10px] font-bold ${me?'text-cyan-300':'text-slate-200'}`}>{m.display_name}</span><span className="text-[8px] text-slate-600">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><div className="text-[11px] text-slate-300 mt-1 break-words">{m.text}</div></div>})}{!messages.length&&!loading&&<div className="text-center text-xs text-slate-600 py-12">Чат пуст. Напишите первым.</div>}</div>
    <form onSubmit={send} className="flex gap-2 border-t border-slate-800 pt-2"><input value={input} onChange={e=>setInput(e.target.value)} maxLength={500} placeholder="Сообщение всему Аэтельгарду…" className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-purple-500"/><button disabled={sending||!input.trim()} className="p-2.5 bg-purple-600 text-white rounded-xl disabled:opacity-40"><Send className="w-4 h-4"/></button></form>
  </div>;
};
