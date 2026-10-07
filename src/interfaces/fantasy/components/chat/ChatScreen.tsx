import {useGlobalChat} from '../../../../hooks/useGlobalChat';
import { t as localize, useLocale } from '../../../../i18n/locale';
import React from 'react';
import { useGame } from '../../../../context/GameContext';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, RpgButton } from '../ui/BestiaryUI';

export const ChatScreen: React.FC = () => {
  useLocale();
  const { player } = useGame();
  const {input,setInput,loading,sending,error,onlinePlayers,load,send,renderedMessages}=useGlobalChat();

  if (!player) return null;

  return (
    <FolioPage className="flex min-h-[calc(100dvh-120px)] flex-col gap-3 pt-3">
      <BestiaryPanel className="p-3">
        <div className="text-[11px] uppercase tracking-widest text-purple-300">{localize("Социальный центр")}</div>
        <div className="flex items-center justify-between mt-1">
          <h2 className="font-cinzel text-lg font-bold">{localize("Общий чат")}</h2>
          <button aria-label={localize("Обновить чат")} onClick={() => void load(true)} disabled={loading} className="rpg-icon-button disabled:opacity-50">
            <RpgIcon kind="refresh" size={18} className={loading ? 'animate-spin' : 'text-slate-400'} />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">{localize("Серверный канал · сообщения видят все игроки")}</span>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 font-mono font-bold text-emerald-300">{localize("● Онлайн: ")}{localize(onlinePlayers)}
          </span>
        </div>
      </BestiaryPanel>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-rose-400 font-bold">!</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{localize("Не удалось подключиться к чату")}</div>
              <div className="mt-1 break-words">{localize(error)}</div>
              <button onClick={() => void load(true)} className="mt-2 min-h-11 rounded-lg border border-rose-500/40 bg-rose-950/50 px-2.5 font-bold">{localize("Повторить")}</button>
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
                <span className="text-[11px] text-slate-600">{localize(time)}</span>
              </div>
              <div className="mt-1 break-words text-xs text-slate-300">{message.text}</div>
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
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-purple-500"
        />
        <RpgButton type="submit" variant="primary" icon="quest" disabled={sending || !input.trim()} className="min-h-11 px-3 disabled:opacity-40" aria-label={localize("Отправить сообщение")} />
      </form>
    </FolioPage>
  );
};
