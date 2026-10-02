import { useSyncExternalStore } from 'react';
import { translateText, type Locale } from './translate';
export type { Locale } from './translate';
export const LANGUAGE_KEY = 'aethelgard_language';
const listeners = new Set<() => void>();
let selected: Locale | undefined;
export function readLanguage(): Locale {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ru' || saved === 'uk') return saved;
  } catch { /* The session remains usable when storage is unavailable. */ }
  const language = typeof window !== 'undefined'
    ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || window.navigator.language
    : 'ru';
  return /^uk(?:-|$)/i.test(language || '') ? 'uk' : 'ru';
}
export const getLanguage = (): Locale => selected ??= readLanguage();
export function setLanguage(language: Locale) {
  if (language !== 'ru' && language !== 'uk') return;
  const previous = getLanguage();
  selected = language;
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Save for this session. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  if (previous !== language) listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLanguage, () => 'ru' as Locale);
  return { locale, setLocale: setLanguage };
}
/** Only call at display boundaries; non-text React children are returned unchanged. */
export function t<T>(value: T): T {
  return (typeof value === 'string' ? translateText(value, getLanguage()) : value) as T;
}
export const intlLocale = () => getLanguage() === 'uk' ? 'uk-UA' : 'ru-RU';
