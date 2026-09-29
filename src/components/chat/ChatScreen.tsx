import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';
import { triggerHaptic } from '../../utils/telegram';

type GlobalMessage = {
  id: number | string;
  text: string;
  created_at: string;
  display_name: string;
  username?: string;
};

const normalizeMessages = (value: unknown): GlobalMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object')
    .map((item: any, index) => ({
      id: item.id ?? `fallback_${index}`,
      text: String(item.text ?? ''),
      created_at: String(item.created_at ?? new Date().toISOString()),
      display_name: String(item.display_name ?? item.username ?? 'Игрок'),
      username: item.username ? String(item.username) : undefined
    }))
    .filter(item => item.text.length > 0);
};

export const ChatScreen: React.FC = () => {
  const { player } = useGame();
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ messages?: unknown }>('/api/chat/global');
      setMessages(normalizeMessages(response?.messages));
      setError('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось подключиться к общему чату.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!alive) return;
      try {
        const response = await apiRequest<{ messages?: unknown }>('/api/chat/global');
        if (!alive) return;
        setMessages(normalizeMessages(response?.messages));
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Не удалось подключиться к общему чату.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const response = await apiRequest<{ message?: unknown }>('/api/chat/global', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      const created = normalizeMessages(response?.message ? [response.message] : []);
      if (created[0]) setMessages(prev => [...prev, created[0]].slice(-80));
      setInput('');
      setError('');
      triggerHaptic('light');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение.');
      triggerHaptic('error');
    } finally {
      setSending(false);
    }
  };

  const playerName = player?.name || '';
  const renderedMessages = useMemo(() => messages.slice(-80), [messages]);

  if (!player) return null;

  return (
    <div className="p-3 max-w-lg mx-auto pb-24 min-h-[calc(100dvh-120px)] flex flex-col gap-3">
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#111025] to-[#080a12] p-4">
        <div className="text-[10px] text-purple-300 font-mono uppercase tracking-widest">Социальный центр</div>
        <div className="flex items-center justify-between mt-1">
          <h2 className="font-cinzel text-lg font-bold">Общий чат</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-[9px] text-slate-500 mt-1">Серверный канал · сообщения видят все игроки</div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/30 border border-rose-500/30 p-3 text-[10px] text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">Не удалось подключиться к чату</div>
              <div className="mt-1 break-words">{error}</div>
              <button onClick={load} className="mt-2 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/50 font-bold">
                Повторить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-[240px] overflow-y-auto space-y-2 pr-1">
        {renderedMessages.map(message => {
          const me = message.display_name === playerName;
          const date = new Date(message.created_at);
          const time = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          return (
            <div
              key={String(message.id)}
              className={`p-2.5 rounded-xl border ${me ? 'ml-5 bg-cyan-950/30 border-cyan-500/30' : 'bg-[#0a0f1d] border-slate-800'}`}
            >
              <div className="flex justify-between gap-2">
                <span className={`text-[10px] font-bold ${me ? 'text-cyan-300' : 'text-slate-200'}`}>
                  {message.display_name}
                </span>
                <span className="text-[8px] text-slate-600">{time}</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 break-words">{message.text}</div>
            </div>
          );
        })}
        {!renderedMessages.length && !loading && !error && (
          <div className="text-center text-xs text-slate-600 py-12">Чат пуст. Напишите первым.</div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-800 pt-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
          placeholder="Сообщение всему Аэтельгарду…"
          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-purple-500"
        />
        <button disabled={sending || !input.trim()} className="p-2.5 bg-purple-600 text-white rounded-xl disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
