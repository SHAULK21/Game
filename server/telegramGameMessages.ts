/** Telegram Web App buttons require an HTTPS URL. Text delivery still works without one. */
export function gameWebAppUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function gameMessagePayload(chatId: number, text: string, baseUrl: string): Record<string, unknown> {
  const url = gameWebAppUrl(baseUrl);
  return {
    chat_id: chatId, text,
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: '⚔️ Играть', web_app: { url } }]] } } : {})
  };
}

export function gameMenuButton(baseUrl: string) {
  const url = gameWebAppUrl(baseUrl);
  return url ? { type: 'web_app', text: '🎮 Играть', web_app: { url } } : null;
}
