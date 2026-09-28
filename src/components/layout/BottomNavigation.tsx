import React, { useState } from 'react';
import { 
  Swords, 
  Compass, 
  Trophy, 
  Backpack, 
  Anvil, 
  FlaskConical, 
  Pickaxe, 
  ShieldCheck, 
  MessageSquare, 
  MoreHorizontal,
  Scroll,
  Sparkles,
  Dog,
  Store,
  Crown
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/telegram';

export type TabId = 
  | 'hunter' 
  | 'world' 
  | 'arena' 
  | 'inventory' 
  | 'blacksmith' 
  | 'alchemy' 
  | 'mine' 
  | 'clan' 
  | 'chat' 
  | 'more';

interface BottomNavigationProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadChatCount?: number;
  availableQuestsCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  unreadChatCount = 0,
  availableQuestsCount = 0
}) => {
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  const handleTabClick = (tab: TabId) => {
    sound.playClick();
    triggerHaptic('light');
    if (tab === 'more') {
      setIsMoreDrawerOpen(prev => !prev);
    } else {
      setIsMoreDrawerOpen(false);
      onSelectTab(tab);
    }
  };

  const selectSecondaryTab = (tab: TabId) => {
    sound.playClick();
    triggerHaptic('medium');
    setIsMoreDrawerOpen(false);
    onSelectTab(tab);
  };

  return (
    <>
      {/* Secondary Drawer Modal */}
      {isMoreDrawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setIsMoreDrawerOpen(false)}
        >
          <div 
            className="bg-[#0b101c] border-t border-cyan-500/30 rounded-t-2xl p-4 max-w-lg mx-auto w-full pb-20 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-cinzel text-sm font-bold text-cyan-300">
                Дополнительные разделы
              </span>
              <span className="text-[11px] text-slate-400">
                10 разделов Аэтельгарда
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <button
                onClick={() => selectSecondaryTab('alchemy')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  currentTab === 'alchemy'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <FlaskConical className="w-5 h-5 mb-1 text-emerald-400" />
                <span className="text-[11px] font-medium">Алхимия</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('mine')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  currentTab === 'mine'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Pickaxe className="w-5 h-5 mb-1 text-amber-400" />
                <span className="text-[11px] font-medium">Шахта</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('clan')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  currentTab === 'clan'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-5 h-5 mb-1 text-blue-400" />
                <span className="text-[11px] font-medium">Клан</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('chat')}
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  currentTab === 'chat'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <MessageSquare className="w-5 h-5 mb-1 text-purple-400" />
                <span className="text-[11px] font-medium">Чат</span>
                {unreadChatCount > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-purple-500 rounded-full" />
                )}
              </button>

              <button
                onClick={() => selectSecondaryTab('more')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  currentTab === 'more'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Scroll className="w-5 h-5 mb-1 text-amber-300" />
                <span className="text-[11px] font-medium">Квесты</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('more')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 transition-all"
              >
                <Dog className="w-5 h-5 mb-1 text-teal-400" />
                <span className="text-[11px] font-medium">Питомцы</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('more')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 transition-all"
              >
                <Crown className="w-5 h-5 mb-1 text-yellow-400" />
                <span className="text-[11px] font-medium">Рейтинг</span>
              </button>

              <button
                onClick={() => selectSecondaryTab('more')}
                className="flex flex-col items-center justify-center p-3 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 transition-all"
              >
                <Store className="w-5 h-5 mb-1 text-cyan-400" />
                <span className="text-[11px] font-medium">Рынок</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-t border-cyan-500/20 max-w-lg mx-auto pb-safe">
        <div className="grid grid-cols-6 items-center h-14 px-1">
          {/* 1. Охотник (Hunter) */}
          <button
            onClick={() => handleTabClick('hunter')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              currentTab === 'hunter' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className={`w-5 h-5 ${currentTab === 'hunter' ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Охотник</span>
          </button>

          {/* 2. Мир (World) */}
          <button
            onClick={() => handleTabClick('world')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              currentTab === 'world' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className={`w-5 h-5 ${currentTab === 'world' ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Мир</span>
          </button>

          {/* 3. Арена (Arena) */}
          <button
            onClick={() => handleTabClick('arena')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              currentTab === 'arena' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className={`w-5 h-5 ${currentTab === 'arena' ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Арена</span>
          </button>

          {/* 4. Инвентарь (Inventory) */}
          <button
            onClick={() => handleTabClick('inventory')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              currentTab === 'inventory' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Backpack className={`w-5 h-5 ${currentTab === 'inventory' ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Сумка</span>
          </button>

          {/* 5. Кузница (Blacksmith) */}
          <button
            onClick={() => handleTabClick('blacksmith')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              currentTab === 'blacksmith' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Anvil className={`w-5 h-5 ${currentTab === 'blacksmith' ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Кузня</span>
          </button>

          {/* 6. Ещё (More Drawer) */}
          <button
            onClick={() => handleTabClick('more')}
            className={`relative flex flex-col items-center justify-center h-full transition-colors ${
              isMoreDrawerOpen || ['alchemy', 'mine', 'clan', 'chat', 'more'].includes(currentTab)
                ? 'text-purple-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 ${isMoreDrawerOpen ? 'scale-125 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Ещё</span>
            {(unreadChatCount > 0 || availableQuestsCount > 0) && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
