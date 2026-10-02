import { useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useLocale } from './locale';
import type { Locale } from './translate';
let pending: Locale | undefined;
let syncing = false;
async function sync(language: Locale) {
  pending = language;
  if (syncing) return;
  syncing = true;
  try {
    while (pending) {
      const next = pending;
      pending = undefined;
      try { await apiRequest('/api/preferences/language', { method: 'POST', body: JSON.stringify({ language: next }) }); }
      catch { /* Local language works offline; retry on the next online event or app open. */ }
    }
  } finally { syncing = false; }
}
export function LanguageSync() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    void sync(locale);
    const online = () => void sync(locale);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [locale]);
  return null;
}
