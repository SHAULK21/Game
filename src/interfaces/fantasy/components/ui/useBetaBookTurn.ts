import { useEffect, useLayoutEffect, useRef } from 'react';

/** One inert DOM copy, never a second mounted game screen or a per-frame screenshot. */
export function useBetaBookTurn() {
  const pageRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const returning = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  const list = useRef<HTMLElement | null>(null);
  const scroll = useRef(0);
  const selected = useRef('');
  useEffect(() => () => cleanup.current?.(), []);
  useLayoutEffect(() => {
    if (busy.current && pageRef.current) {
      if (returning.current && window.scrollY !== scroll.current) window.scrollTo(0, scroll.current);
      pageRef.current.inert = true;
      pageRef.current.setAttribute('aria-hidden', 'true');
    }
  });

  const turn = (backwards: boolean, navigate: () => void, monsterId?: string) => {
    if (busy.current || !pageRef.current) return;
    const source = pageRef.current;
    if (!backwards) {
      scroll.current = window.scrollY;
      selected.current = monsterId || '';
      list.current = source.cloneNode(true) as HTMLElement;
    }
    const snapshot = (backwards ? list.current : source)?.cloneNode(true) as HTMLElement | undefined;
    const overlay = document.createElement('div');
    overlay.className = `beta-page-turn beta-content-turn is-${backwards ? 'backwards' : 'forwards'}`;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    const leaf = document.createElement('div');
    leaf.className = 'beta-turn-leaf';
    const front = document.createElement('div');
    front.className = 'beta-turn-front';
    if (snapshot) {
      // The inspected texture has a spine in its left 6.5%. Crop that stationary strip.
      snapshot.querySelector('.hunt-book-surface')?.remove();
      snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      snapshot.removeAttribute('id');
      snapshot.classList.add('beta-turn-copy');
      snapshot.style.width = `${source.getBoundingClientRect().width || 430}px`;
      snapshot.style.position = 'absolute';
      snapshot.style.left = '-6.95%';
      snapshot.style.top = `-${scroll.current}px`;
      front.append(snapshot);
    }
    const back = document.createElement('div');
    back.className = 'beta-turn-back';
    leaf.append(front, back);
    overlay.append(leaf);
    busy.current = true;
    returning.current = backwards;
    navigate();
    document.body.append(overlay);
    let finished = false;
    const finish = (focus = true) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('resize', cancel);
      media?.removeEventListener?.('change', cancel);
      overlay.remove();
      busy.current = false;
      if (pageRef.current) {
        pageRef.current.inert = false;
        pageRef.current.removeAttribute('aria-hidden');
      }
      cleanup.current = null;
      if (!focus) return;
      if (backwards && window.scrollY !== scroll.current) window.scrollTo(0, scroll.current);
      const target = backwards
        ? Array.from(pageRef.current?.querySelectorAll<HTMLButtonElement>('[data-monster-id]') || []).find(el => el.dataset.monsterId === selected.current)
        : pageRef.current?.querySelector<HTMLElement>('#bestiary-dossier-title');
      target?.focus({ preventScroll: true });
    };
    const cancel = () => finish();
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const timer = window.setTimeout(() => finish(), media?.matches ? 180 : 480);
    leaf.addEventListener('animationend', event => {
      if (event.target === leaf) finish();
    });
    window.addEventListener('resize', cancel);
    media?.addEventListener?.('change', cancel);
    cleanup.current = () => finish(false);
  };
  return { pageRef, turn };
}
