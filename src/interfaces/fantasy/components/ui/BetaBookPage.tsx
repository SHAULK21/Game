import type { PropsWithChildren, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { t, useLocale } from '../../../../i18n/locale';
import { RpgIcon } from './RpgIcon';

const pages = {
  hunter: { title: 'Охота', icon: 'hunt' },
  world: { title: 'Мир', icon: 'map' },
  character: { title: 'Лист героя', icon: 'character' },
  arena: { title: 'Арена', icon: 'arena' },
  inventory: { title: 'Сумка', icon: 'inventory' },
  blacksmith: { title: 'Кузница охотника', icon: 'forge' },
  crafting: { title: 'Создание предметов', icon: 'weapon' },
  alchemy: { title: 'Алхимия', icon: 'alchemy' },
  mine: { title: 'Шахта', icon: 'mine' },
  fishing: { title: 'Рыбалка', icon: 'fish' },
  clan: { title: 'Клан', icon: 'clan' },
  chat: { title: 'Чат', icon: 'quest' },
  market: { title: 'Рынок', icon: 'market' },
  pets: { title: 'Спутник', icon: 'pet' },
  leaderboard: { title: 'Рейтинг', icon: 'crown' },
  more: { title: 'Журнал приключений', icon: 'quest' }
} as const;
export type BetaBookTab = keyof typeof pages;

export function BetaBookPage({ page, children }: PropsWithChildren<{ page: BetaBookTab }>) {
  useLocale();
  return <div className={`beta-book-page beta-book-${page}`} data-beta-book-page={page}>
    <header className="beta-book-heading"><RpgIcon kind={pages[page].icon} size={36} /><h1>{t(pages[page].title)}</h1><span className="beta-chapter-number" aria-hidden="true">{String(Object.keys(pages).indexOf(page)).padStart(2, '0')}</span></header>
    <div className="beta-chapter-content">{children}</div>
  </div>;
}

const order = Object.keys(pages);
export function BetaPageTurn({ page, snapshot }: { page: string; snapshot?: RefObject<HTMLElement | null> }) {
  const front = useRef<HTMLDivElement>(null);
  const previous = useRef(page);
  const sequence = useRef(0);
  const [turn, setTurn] = useState<{ id: number; direction: string } | null>(null);
  useEffect(() => {
    if (previous.current === page) return;
    const from = previous.current;
    if (!order.includes(page) || !order.includes(from)) {
      previous.current = page;
      setTurn(null);
      return;
    }
    const backwards = order.indexOf(page) < order.indexOf(from);
    previous.current = page;
    setTurn(null);
    let timer: number | undefined;
    const main = document.querySelector('.game-shell > main');
    const start = () => {
      if (main?.querySelector('[role="status"]')?.textContent?.match(/Загрузка раздела|Завантаження розділу/)) return;
      observer?.disconnect();
      setTurn({ id: ++sequence.current, direction: backwards ? 'backwards' : 'forwards' });
      timer = window.setTimeout(() => setTurn(null), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 140 : 500);
    };
    const observer = main ? new MutationObserver(start) : undefined;
    observer?.observe(main!, { childList: true, subtree: true });
    const cancel = () => { observer?.disconnect(); window.clearTimeout(timer); setTurn(null); };
    window.addEventListener('resize', cancel);
    start();
    return () => { observer?.disconnect(); window.clearTimeout(timer); window.removeEventListener('resize', cancel); };
  }, [page]);
  useEffect(() => {
    if (turn && front.current && snapshot?.current) {
      const copy = snapshot.current;
      copy.querySelectorAll('.hunt-book-surface').forEach(node => node.remove());
      front.current.append(copy);
      snapshot.current = null;
    }
  }, [turn, snapshot]);
  return turn && <div key={turn.id} className={`beta-page-turn is-${turn.direction}`} aria-hidden="true" onAnimationEnd={event => { if ((event.target as HTMLElement).classList.contains('beta-turn-leaf')) setTurn(null); }}><div className="beta-turn-leaf"><div ref={front} className="beta-turn-front" /><div className="beta-turn-back" /></div></div>;
}
