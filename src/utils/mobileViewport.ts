import { getTelegramWebApp, isInsideTelegram } from './telegram';

/** Keep sheets inside the visible area without mistaking pinch zoom for a keyboard. */
export function observeMobileViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const tg = isInsideTelegram() ? getTelegramWebApp() : null;
  const properties = ['--app-visible-height', '--app-visible-top', ...['top', 'bottom', 'left', 'right'].flatMap(edge => [`--app-tg-safe-${edge}`, `--app-tg-content-${edge}`])];
  const previous = properties.map(name => root.style.getPropertyValue(name));
  const previousKeyboard = root.dataset.keyboardOpen;
  let frame = 0;
  const update = () => {
    frame = 0;
    const layoutHeight = window.innerHeight;
    const unzoomed = !viewport || Math.abs(viewport.scale - 1) < .05;
    const height = Math.min(layoutHeight, unzoomed && viewport ? viewport.height : layoutHeight, tg?.viewportHeight && tg.viewportHeight > 0 ? tg.viewportHeight : layoutHeight);
    const editable = document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),textarea,[contenteditable="true"]');
    const keyboard = Boolean(editable && unzoomed && layoutHeight - height > 150);
    root.dataset.keyboardOpen = String(keyboard);
    root.style.setProperty('--app-visible-height', `${Math.max(1, height)}px`);
    root.style.setProperty('--app-visible-top', `${keyboard ? Math.max(0, viewport?.offsetTop || 0) : 0}px`);
    if (keyboard) {
      const control = document.activeElement as HTMLElement | null;
      const bounds = control?.getBoundingClientRect();
      const top = Math.max(0, viewport?.offsetTop || 0);
      if (bounds && (bounds.top < top + 12 || bounds.bottom > top + height - 12))
        control?.scrollIntoView?.({ block:'nearest', inline:'nearest' });
    }
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      const safe = tg?.safeAreaInset?.[edge];
      const content = tg?.contentSafeAreaInset?.[edge];
      if (safe !== undefined) root.style.setProperty(`--app-tg-safe-${edge}`, `${Math.max(0, safe)}px`);
      if (content !== undefined) root.style.setProperty(`--app-tg-content-${edge}`, `${Math.max(0, content)}px`);
    }
  };
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame ? window.requestAnimationFrame(update) : window.setTimeout(update, 16);
  };
  update();
  window.addEventListener('resize', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  const events = ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'];
  events.forEach(event => tg?.onEvent?.(event, schedule));
  return () => {
    if (frame) { if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame); else window.clearTimeout(frame); }
    window.removeEventListener('resize', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    events.forEach(event => tg?.offEvent?.(event, schedule));
    properties.forEach((name, i) => previous[i] ? root.style.setProperty(name, previous[i]) : root.style.removeProperty(name));
    if (previousKeyboard === undefined) delete root.dataset.keyboardOpen;
    else root.dataset.keyboardOpen = previousKeyboard;
  };
}
