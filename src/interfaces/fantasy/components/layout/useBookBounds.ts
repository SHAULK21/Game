import { useLayoutEffect, useRef } from 'react';

/** The beta leaves begin below the real HUD, including notch and host controls. */
export function useBookBounds(enabled: boolean, page: string) {
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!enabled || !shellRef.current) return;
    const shell = shellRef.current;
    const header = shell.querySelector<HTMLElement>('.fantasy-shell-header');
    if (!header) return;
    const update = () => shell.style.setProperty('--beta-book-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(header);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive:true });
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); shell.style.removeProperty('--beta-book-top'); };
  }, [enabled, page]);
  return shellRef;
}
