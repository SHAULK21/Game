import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { t, useLocale } from '../../../../i18n/locale';
import { RpgIcon } from './RpgIcon';

const pages = {
  world: { title: 'Мир', icon: 'map' },
  arena: { title: 'Арена', icon: 'arena' },
  inventory: { title: 'Сумка', icon: 'inventory' }
} as const;

export function BetaBookPage({ page, children }: PropsWithChildren<{ page: keyof typeof pages }>) {
  useLocale();
  return <div className={`beta-book-page beta-book-${page}`} data-beta-book-page={page}>
    <header className="beta-book-heading"><RpgIcon kind={pages[page].icon} size={36} /><h1>{t(pages[page].title)}</h1></header>
    {children}
  </div>;
}

const order = ['hunter', 'world', 'arena', 'inventory'];
export function BetaPageTurn({ page }: { page: string }) {
  const previous = useRef(page);
  const sequence = useRef(0);
  const [turn, setTurn] = useState<{ id: number; direction: string } | null>(null);
  useEffect(() => {
    if (previous.current === page) return;
    const backwards = order.indexOf(page) < order.indexOf(previous.current);
    previous.current = page;
    setTurn({ id: ++sequence.current, direction: backwards ? 'backwards' : 'forwards' });
    const timer = window.setTimeout(() => setTurn(null), 500);
    return () => window.clearTimeout(timer);
  }, [page]);
  return turn && <div key={turn.id} className={`beta-page-turn is-${turn.direction}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)}><div /></div>;
}
