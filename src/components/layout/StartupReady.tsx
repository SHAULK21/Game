import { useEffect } from 'react';

/** Mounted only when the first usable screen has committed, including lazy interfaces. */
export function StartupReady() {
  useEffect(() => {
    const splash = document.getElementById('startup-splash');
    if (!splash || splash.classList.contains('splash-leaving')) return;
    splash.classList.add('splash-leaving');
    const remove = () => splash.remove();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
    else {
      splash.addEventListener('transitionend', remove, { once: true });
      // A backgrounded webview may not dispatch transitionend.
      window.setTimeout(remove, 350);
    }
  }, []);
  return null;
}
