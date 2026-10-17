import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
import {handleBotMessage, validateNativeWorld, PRODUCTION_DOCUMENT} from '../lib/gameEngine.js';
import {drainDeliveries} from '../lib/deliveryWorker.js';
export default async function (message, ctx) {
  const at = Date.now();
  const result = await nativeTransactions.update(PRODUCTION_DOCUMENT, async world => {
    const result = await handleBotMessage(world, message, ctx?.update?.update_id, at);
    validateNativeWorld(world); return result;
  });
  await drainDeliveries(3);
  return result;
}
