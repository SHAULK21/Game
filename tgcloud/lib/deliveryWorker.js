import {api} from 'sdk';
import {nativeTransactions} from './nativeAtomicStorage.js';
import {claimDeliveries, acknowledgeDelivery, PRODUCTION_DOCUMENT} from './gameEngine.js';

// Call only after committing gameplay. No Bot API call occurs in a CAS retry.
export async function drainDeliveries(limit = 10) {
  const worker = crypto.randomUUID();
  let batch;
  try {batch = await nativeTransactions.update(PRODUCTION_DOCUMENT, world => claimDeliveries(world, worker, Date.now(), limit));}
  catch (error) {if (error?.code === 'STATE_NOT_INITIALIZED') return {sent: 0, failed: 0, suppressed: 0, initialized: false}; throw error;}
  let sent = 0, failed = 0;
  for (const job of batch.jobs) {
    let ok = false, blocked = false;
    try {
      if (job.method === 'sendMessage') await api.sendMessage(job.payload);
      else if (job.method === 'setChatMenuButton') await api.setChatMenuButton(job.payload);
      else throw new Error('Unsupported outbox method.');
      ok = true; sent++;
    } catch (error) {failed++; blocked = /blocked|chat not found|deactivated/i.test(String(error?.description || error));}
    await nativeTransactions.update(PRODUCTION_DOCUMENT, world => acknowledgeDelivery(world, job, {ok, blocked}, Date.now()));
  }
  return {sent, failed, suppressed: batch.suppressed, initialized: true};
}
