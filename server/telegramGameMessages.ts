import { translateText, type Locale } from '../src/i18n/translate';
/** Telegram Web App buttons require an HTTPS URL. Text delivery still works without one. */
export function gameWebAppUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function gameMessagePayload(chatId: number, text: string, baseUrl: string, language: Locale = 'ru'): Record<string, unknown> {
  const url = gameWebAppUrl(baseUrl);
  return {
    chat_id: chatId, text: translateText(text, language),
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: language === 'uk' ? '⚔️ Грати' : '⚔️ Играть', web_app: { url } }]] } } : {})
  };
}

export function gameMenuButton(baseUrl: string, language: Locale = 'ru') {
  const url = gameWebAppUrl(baseUrl);
  return url ? { type: 'web_app', text: language === 'uk' ? '🎮 Грати' : '🎮 Играть', web_app: { url } } : null;
}

export function messageLanguage(preferred: unknown, telegramLanguage?: unknown): Locale {
  if (preferred === 'uk' || preferred === 'ru') return preferred;
  return typeof telegramLanguage === 'string' && /^uk(?:-|$)/i.test(telegramLanguage) ? 'uk' : 'ru';
}
