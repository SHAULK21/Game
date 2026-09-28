import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MessageSquare, Send, Users, ShieldAlert } from 'lucide-react';

export const ChatScreen: React.FC = () => {
  const { chatMessages, sendChatMessage, onlinePlayersCount, player } = useGame();
  const [activeChannel, setActiveChannel] = useState<'global' | 'clan'>('global');
  const [inputText, setInputText] = useState('');

  if (!player) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(inputText, activeChannel);
    setInputText('');
  };

  const filtered = chatMessages.filter(m => activeChannel === 'global' ? true : m.channel === 'clan');

  return (
    <div className="p-3 space-y-3 max-w-lg mx-auto pb-24 flex flex-col h-[calc(100vh-130px)]">
      {/* Top Channel Tabs & Online Counter */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveChannel('global')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              activeChannel === 'global'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Общий чат
          </button>
          <button
            onClick={() => setActiveChannel('clan')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              activeChannel === 'clan'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Клан [NEXUS]
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{onlinePlayersCount} онлайн</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
        {filtered.map(msg => {
          const isMe = msg.sender === player.name;
          return (
            <div
              key={msg.id}
              className={`p-2.5 rounded-xl border ${
                isMe
                  ? 'bg-cyan-950/30 border-cyan-500/30 ml-4'
                  : msg.isVip
                  ? 'bg-amber-950/30 border-amber-500/30'
                  : 'bg-[#0a0f1d] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {msg.clanTag && (
                    <span className="text-[10px] font-mono text-purple-400 font-bold">
                      [{msg.clanTag}]
                    </span>
                  )}
                  <span className={`font-cinzel text-xs font-bold ${isMe ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {msg.sender}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {msg.timestamp}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed font-sans">
                {msg.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-800">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={`Сообщение в ${activeChannel === 'global' ? 'общий' : 'клановый'} чат...`}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl active:scale-95 transition-all shadow-md shadow-cyan-950"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
