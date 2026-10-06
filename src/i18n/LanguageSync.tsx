import { useInterface, type InterfaceStyle } from '../context/InterfaceContext';
import { useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useLocale } from './locale';
import type { Locale } from './translate';
let pending: { language: Locale; interfaceStyle: InterfaceStyle } | undefined;
let syncing = false;
async function sync(language: Locale, interfaceStyle: InterfaceStyle) {
  pending = { language, interfaceStyle };
  if (syncing) return;
  syncing = true;
  try {
    while (pending) {
      const next = pending;
      pending = undefined;
      try { await apiRequest('/api/preferences/language', { method: 'POST', body: JSON.stringify(next) }); }
      catch { /* Local language works offline; retry on the next online event or app open. */ }
    }
  } finally { syncing = false; }
}
export function LanguageSync() {
  const { locale } = useLocale();
  const { style } = useInterface();
  useEffect(() => {
    document.documentElement.lang = locale;
    void sync(locale, style);
    const online = () => void sync(locale, style);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [locale, style]);
  return null;
}
