import { t as localize, useLocale } from '../../../../i18n/locale';
import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../../../../utils/audio';
import { triggerHaptic } from '../../../../utils/telegram';
import { RpgIcon, RpgIconKind } from '../ui/RpgIcon';

import type { GameTabId } from '../../../../types/navigation';
export type TabId = GameTabId;
interface BottomNavigationProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadChatCount?: number;
  availableQuestsCount?: number;
}

const primary: Array<{ id: TabId; label: string; icon: RpgIconKind }> = [
  { id: 'world', label: 'Мир', icon: 'map' },
  { id: 'hunter', label: 'Охота', icon: 'bestiary' },
  { id: 'character', label: 'Герой', icon: 'character' },
  { id: 'inventory', label: 'Сумка', icon: 'inventory' },
];

const secondary: Array<{ id: TabId; label: string; icon: RpgIconKind }> = [
  { id: 'arena', label: 'Арена', icon: 'arena' },
  { id: 'blacksmith', label: 'Кузница', icon: 'forge' },
  { id: 'crafting', label: 'Ремесло', icon: 'forge' },
  { id: 'alchemy', label: 'Алхимия', icon: 'alchemy' },
  { id: 'mine', label: 'Шахта', icon: 'mine' },
  { id: 'market', label: 'Рынок', icon: 'market' },
  { id: 'clan', label: 'Клан', icon: 'clan' },
  { id: 'pets', label: 'Спутники', icon: 'pet' },
  { id: 'chat', label: 'Чат', icon: 'skill' },
  { id: 'leaderboard', label: 'Рейтинг', icon: 'crown' },
  { id: 'more', label: 'Журнал', icon: 'quest' },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentTab, onSelectTab, unreadChatCount = 0, availableQuestsCount = 0 }) => {
  useLocale();
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
  const hasUnread = unreadChatCount > 0 || availableQuestsCount > 0;

  return <>
    {open && <div className="bottom-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="sections-title" className="game-drawer w-full max-w-lg rounded-t-2xl p-4 pb-safe" onClick={event => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div><div className="text-[11px] uppercase tracking-[.16em] text-[#918c82]">{localize("Навигация")}</div><h2 id="sections-title" className="section-title text-lg">{localize("Другие разделы")}</h2></div>
          <button className="rpg-icon-button" aria-label={localize("Закрыть меню")} onClick={() => setOpen(false)}><span className="text-xl leading-none">×</span></button>
        </div>
        <div className="mb-3 ornament-divider" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {secondary.map(({ id, label, icon }) => {
            const count = id === 'chat' ? unreadChatCount : id === 'more' ? availableQuestsCount : 0;
            return <button key={id} aria-current={currentTab === id ? 'page' : undefined} onClick={() => select(id)} className={`game-section relative flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg p-2 text-xs ${currentTab === id ? 'is-active' : ''}`}>
              <RpgIcon kind={icon} size={23} /><span>{localize(label)}</span>
              {count > 0 && <span className="nav-count absolute right-1.5 top-1" aria-label={localize(`${count} новых`)}>{localize(count > 99 ? '99+' : count)}</span>}
            </button>;
          })}
        </div>
      </div>
    </div>}
    <nav aria-label={localize("Основные разделы")} className="game-nav fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-lg pb-safe">
      <div className="grid h-16 grid-cols-5 px-1">
        {primary.map(({ id, label, icon }) => <button key={id} aria-current={currentTab === id ? 'page' : undefined} className={`game-nav-item flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${currentTab === id ? 'is-active' : ''}`} onClick={() => select(id)}><RpgIcon kind={icon} size={21} /><span>{localize(label)}</span></button>)}
        <button ref={moreRef} aria-expanded={open} aria-haspopup="dialog" onClick={() => { sound.playClick(); triggerHaptic('light'); setOpen(value => !value); }} className={`game-nav-item relative flex flex-col items-center justify-center gap-1 text-[11px] ${open || secondary.some(tab => tab.id === currentTab) ? 'is-active' : ''}`}>
          <RpgIcon kind="more" size={21} /><span>{localize("Ещё")}</span>
          {hasUnread && <span className="nav-dot absolute right-3 top-3" aria-label={localize("Есть новые события")} />}
        </button>
      </div>
    </nav>
  </>;
};
