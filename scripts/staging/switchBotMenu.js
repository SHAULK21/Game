import {db, api} from 'sdk';
import {PRODUCTION_DOCUMENT, validateNativeWorld} from '../lib/gameEngine.js';
export default async function () {
  const stored = await db.get('SELECT document FROM game_atomic_documents WHERE id=:id', {':id': PRODUCTION_DOCUMENT});
  if (!stored) throw new Error('Production not initialized.');
  const world = JSON.parse(stored.document); validateNativeWorld(world);
  const url = 'https://app8958621621.tgcloud.ai/';
  await api.setChatMenuButton({menu_button: {type: 'web_app', text: 'Играть', web_app: {url}}});
  let updated = 0, failed = 0;
  for (const row of world.tables.players) {
    if (!row.bot_started) continue;
    try {await api.setChatMenuButton({chat_id: Number(row.telegram_id), menu_button: {type: 'web_app', text: row.preferred_language === 'uk' ? 'Грати' : 'Играть', web_app: {url}}}); updated++;}
    catch {failed++;}
  }
  return {defaultMenu: await api.getChatMenuButton(), updated, failed};
}
