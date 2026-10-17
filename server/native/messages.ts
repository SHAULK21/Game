import {translateText, type Locale} from '../../src/i18n/translate';
// Native V8 exposes no URL constructor. Base URLs here are server configuration,
// never client input; accept only credential-free ASCII HTTPS authorities.
export function gameWebAppUrl(value: string): string | null {
  const url = value.trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[^\s\\]*)?$/i.test(url)) return null;
  return /^https:\/\/[^/]+$/i.test(url) ? url + '/' : url;
}
export function gameMenuButton(baseUrl: string, language: Locale = 'ru') {
  const url = gameWebAppUrl(baseUrl);
  return url ? {type: 'web_app', text: language === 'uk' ? '🎮 Грати' : '🎮 Играть', web_app: {url}} : null;
}
export function gameMessagePayload(chatId: number, text: string, baseUrl: string, language: Locale = 'ru'): Record<string, unknown> {
  const url = gameWebAppUrl(baseUrl);
  return {chat_id: chatId, text: translateText(text, language), ...(url ? {reply_markup: {inline_keyboard: [[{text: language === 'uk' ? '⚔️ Грати' : '⚔️ Играть', web_app: {url}}]]}} : {})};
}
