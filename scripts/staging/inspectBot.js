import {api} from 'sdk';
export default async function () {
  const bot = await api.getMe();
  return {id: bot.id, username: bot.username, menu: await api.getChatMenuButton()};
}
