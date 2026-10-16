import crypto from 'node:crypto';
export function verifyTelegramInitData(initData: string, botToken: string, now = Date.now() / 1000) {
  const params = new URLSearchParams(initData), signature = params.get('hash') || '', date = Number(params.get('auth_date'));
  if (!botToken || !/^[0-9a-f]{64}$/i.test(signature) || !date || Math.abs(now - date) > 7 * 86400) throw new Error('Откройте игру заново из Telegram.');
  const text = [...params].filter(([key]) => key !== 'hash').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(text).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Неверная подпись Telegram.');
  const user = JSON.parse(params.get('user') || '{}');
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Telegram ID отсутствует.');
  return {id: user.id as number, username: user.username as string | undefined, displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок', allowsWriteToPm: user.allows_write_to_pm === true};
}
