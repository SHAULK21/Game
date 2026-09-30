import React, { useEffect, useRef, useState } from 'react';
import { Swords, Compass, Trophy, Backpack, Anvil, Hammer, FlaskConical, Pickaxe, ShieldCheck, MessageSquare, MoreHorizontal, Scroll, Dog, Store, Crown, X } from 'lucide-react';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/telegram';

export type TabId = 'hunter' | 'world' | 'arena' | 'inventory' | 'blacksmith' | 'crafting' | 'alchemy' | 'mine' | 'clan' | 'chat' | 'market' | 'pets' | 'leaderboard' | 'more';
interface BottomNavigationProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadChatCount?: number;
  availableQuestsCount?: number;
}
const primary = [
  { id: 'hunter', label: 'Охота', icon: Swords },
  { id: 'world', label: 'Мир', icon: Compass },
  { id: 'arena', label: 'Арена', icon: Trophy },
  { id: 'inventory', label: 'Сумка', icon: Backpack },
  { id: 'crafting', label: 'Крафт', icon: Hammer },
] as const;
const secondary = [
  { id: 'blacksmith', label: 'Кузница', icon: Anvil },
  { id: 'alchemy', label: 'Алхимия', icon: FlaskConical },
  { id: 'mine', label: 'Шахта', icon: Pickaxe },
  { id: 'clan', label: 'Клан', icon: ShieldCheck },
  { id: 'chat', label: 'Чат', icon: MessageSquare },
  { id: 'more', label: 'Квесты', icon: Scroll },
  { id: 'pets', label: 'Питомцы', icon: Dog },
  { id: 'leaderboard', label: 'Рейтинг', icon: Crown },
  { id: 'market', label: 'Рынок', icon: Store },
] as const;

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentTab, onSelectTab, unreadChatCount = 0, availableQuestsCount = 0 }) => {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const buttons = drawerRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      moreRef.current?.focus();
    };
  }, [open]);
  const select = (tab: TabId) => {
    sound.playClick();
    triggerHaptic('light');
    setOpen(false);
    onSelectTab(tab);
  };
  return <>
    {open && <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={() => setOpen(false)}>
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="sections-title" className="game-drawer w-full max-w-md rounded-t-2xl p-4 pb-safe" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="sections-title" className="text-lg font-semibold">Разделы игры</h2>
          <button className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/5" aria-label="Закрыть меню" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {secondary.map(({ id, label, icon: Icon }) => {
            const count = id === 'chat' ? unreadChatCount : id === 'more' ? availableQuestsCount : 0;
            return <button key={id} aria-current={currentTab === id ? 'page' : undefined} onClick={() => select(id)} className={`game-section relative flex flex-col items-center justify-center gap-2 rounded-lg py-4 text-xs ${currentTab === id ? 'is-active' : ''}`}>
              <Icon size={22} strokeWidth={1.6} /><span>{label}</span>
              {count > 0 && <span className="nav-count absolute top-1 right-2" aria-label={`${count} новых`}>{count > 99 ? '99+' : count}</span>}
            </button>;
          })}
        </div>
      </div>
    </div>}
    <nav aria-label="Основные разделы" className="game-nav fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto pb-safe">
      <div className="grid grid-cols-6 h-16 px-1">
        {primary.map(({ id, label, icon: Icon }) => <button key={id} aria-current={currentTab === id ? 'page' : undefined} className={`game-nav-item flex flex-col items-center justify-center gap-1 text-[11px] ${currentTab === id ? 'is-active' : ''}`} onClick={() => select(id)}><Icon size={21} strokeWidth={1.7} /><span>{label}</span></button>)}
        <button ref={moreRef} aria-expanded={open} aria-haspopup="dialog" onClick={() => { sound.playClick(); triggerHaptic('light'); setOpen(value => !value); }} className={`game-nav-item relative flex flex-col items-center justify-center gap-1 text-[11px] ${open || secondary.some(tab => tab.id === currentTab) ? 'is-active' : ''}`}>
          <MoreHorizontal size={21} /><span>Ещё</span>
          {(unreadChatCount > 0 || availableQuestsCount > 0) && <span className="nav-dot absolute top-3 right-3" aria-label="Есть новые события" />}
        </button>
      </div>
    </nav>
  </>;
};
