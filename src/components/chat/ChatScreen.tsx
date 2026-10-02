import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';
import { triggerHaptic } from '../../utils/telegram';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, RpgButton } from '../ui/BestiaryUI';

type GlobalMessage = {
  id: number | string;
  text: string;
  created_at: string;
  display_name: string;
  telegram_id?: number | string;
  is_premium?: boolean;
};

const normalizeMessages = (value: unknown): GlobalMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object')
    .map((item: any, index) => ({
      id: item.id ?? `fallback_${index}`,
      text: String(item.text ?? ''),
      created_at: String(item.created_at ?? new Date().toISOString()),
      display_name: String(item.display_name || 'Игрок'),
      telegram_id: item.telegram_id,
      is_premium: Boolean(item.is_premium)
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
  const [onlinePlayers, setOnlinePlayers] = useState(0);

  const requestInFlight = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(async (showLoading = false) => {
    if (requestInFlight.current || !mounted.current) return;
    requestInFlight.current = true;
    if (showLoading) setLoading(true);
    try {
      const [response, stats] = await Promise.all([
        apiRequest<{ messages?: unknown }>('/api/chat/global'),
        apiRequest<{ onlinePlayers: number }>('/api/community/stats')
      ]);
      if (!mounted.current) return;
      setMessages(normalizeMessages(response?.messages));
      setOnlinePlayers(Number(stats?.onlinePlayers || 0));
      setError('');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Не удалось подключиться к общему чату.');
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { if (!document.hidden) void load(); };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      if (player) await apiRequest('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({ characterName: player.name, level: player.level, arenaRating: player.arenaRating })
      });
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

  const renderedMessages = useMemo(() => messages.slice(-80), [messages]);

  if (!player) return null;

  return (
    <FolioPage className="flex min-h-[calc(100dvh-120px)] flex-col gap-3 pt-3">
      <BestiaryPanel className="p-3">
        <div className="text-[11px] uppercase tracking-widest text-purple-300">Социальный центр</div>
        <div className="flex items-center justify-between mt-1">
          <h2 className="font-cinzel text-lg font-bold">Общий чат</h2>
          <button aria-label="Обновить чат" onClick={() => void load(true)} disabled={loading} className="rpg-icon-button disabled:opacity-50">
            <RpgIcon kind="refresh" size={18} className={loading ? 'animate-spin' : 'text-slate-400'} />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">Серверный канал · сообщения видят все игроки</span>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 font-mono font-bold text-emerald-300">
            ● Онлайн: {onlinePlayers}
          </span>
        </div>
      </BestiaryPanel>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-rose-400 font-bold">!</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">Не удалось подключиться к чату</div>
              <div className="mt-1 break-words">{error}</div>
              <button onClick={() => void load(true)} className="mt-2 min-h-11 rounded-lg border border-rose-500/40 bg-rose-950/50 px-2.5 font-bold">
                Повторить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-[240px] overflow-y-auto space-y-2 pr-1">
        {renderedMessages.map(message => {
          const me = message.telegram_id != null && String(message.telegram_id) === String(player.userId);
          const date = new Date(message.created_at);
          const time = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          return (
            <div
              key={String(message.id)}
              className={`p-2.5 rounded-xl border ${me ? 'ml-5 bg-cyan-950/30 border-slate-700' : 'bg-[#0a0f1d] border-slate-800'}`}
            >
              <div className="flex justify-between gap-2">
                <span className={`text-[11px] font-bold ${me ? 'text-[#d5ba89]' : 'text-slate-200'}`}>
                  {message.is_premium && <RpgIcon kind="crown" size={13} className="mr-1 inline-flex text-amber-300" title="Premium" />}
                  {message.display_name}
                </span>
                <span className="text-[11px] text-slate-600">{time}</span>
              </div>
              <div className="mt-1 break-words text-xs text-slate-300">{message.text}</div>
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
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-purple-500"
        />
        <RpgButton type="submit" variant="primary" icon="quest" disabled={sending || !input.trim()} className="min-h-11 px-3 disabled:opacity-40" aria-label="Отправить сообщение" />
      </form>
    </FolioPage>
  );
};
