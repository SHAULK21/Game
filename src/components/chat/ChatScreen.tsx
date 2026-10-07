import {useGlobalChat} from '../../hooks/useGlobalChat';
import { t as localize, useLocale } from '../../i18n/locale';
import React from 'react';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { useGame } from '../../context/GameContext';

export const ChatScreen: React.FC = () => {
  useLocale();
  const { player } = useGame();
  const {input,setInput,loading,sending,error,onlinePlayers,load,send,renderedMessages}=useGlobalChat();

  if (!player) return null;

  return (
    <div className="p-3 max-w-lg mx-auto pb-24 min-h-[calc(100dvh-120px)] flex flex-col gap-3">
      <div className="ui-panel rounded-2xl border p-4">
        <div className="text-[10px] text-purple-300 font-mono uppercase tracking-widest">{localize("Социальный центр")}</div>
        <div className="flex items-center justify-between mt-1">
          <h2 className="font-cinzel text-lg font-bold">{localize("Общий чат")}</h2>
          <button onClick={() => void load(true)} disabled={loading} className="p-2 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[9px] mt-1">
          <span className="text-slate-500">{localize("Серверный канал · сообщения видят все игроки")}</span>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 font-mono font-bold text-emerald-300">{localize("● Онлайн: ")}{localize(onlinePlayers)}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/30 border border-rose-500/30 p-3 text-[10px] text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{localize("Не удалось подключиться к чату")}</div>
              <div className="mt-1 break-words">{localize(error)}</div>
              <button onClick={() => void load(true)} className="mt-2 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/50 font-bold">{localize("Повторить")}</button>
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
                <span className={`text-[10px] font-bold ${me ? 'text-[#d5ba89]' : 'text-slate-200'}`}>
                  {message.is_premium && <span className="mr-1 text-amber-300" title="Premium">👑</span>}
                  {message.display_name}
                </span>
                <span className="text-[8px] text-slate-600">{localize(time)}</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 break-words">{message.text}</div>
            </div>
          );
        })}
        {!renderedMessages.length && !loading && !error && (
          <div className="text-center text-xs text-slate-600 py-12">{localize("Чат пуст. Напишите первым.")}</div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-800 pt-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
          placeholder={localize("Сообщение всему Аэтельгарду…")}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-purple-500"
        />
        <button disabled={sending || !input.trim()} className="p-2.5 bg-purple-600 text-white rounded-xl disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
