import { useLayoutEffect, useRef } from 'react';

/** The beta leaves begin below the real HUD, including notch and host controls. */
export function useBookBounds(enabled: boolean, page: string) {
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!enabled || !shellRef.current) return;
    const shell = shellRef.current;
    const header = shell.querySelector<HTMLElement>('.fantasy-shell-header');
    if (!header) return;
    let frame: number | undefined, last = '';
    const update = () => {
      frame = undefined;
      const value = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
      if (value !== last) { shell.style.setProperty('--beta-book-top', value); last = value; }
    };
    const schedule = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame ? window.requestAnimationFrame(update) : window.setTimeout(update, 16);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(header);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive:true });
    return () => { if (frame !== undefined) { if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame); else window.clearTimeout(frame); } observer?.disconnect(); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule); shell.style.removeProperty('--beta-book-top'); };
  }, [enabled, page]);
  return shellRef;
}
