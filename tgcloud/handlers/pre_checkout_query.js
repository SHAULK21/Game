import {api} from 'sdk';
import {validCheckout} from '../lib/gameEngine.js';
export default async function (query) {
  const valid = validCheckout(query);
  await api.answerPreCheckoutQuery({pre_checkout_query_id: query.id, ok: valid,
    ...(valid ? {} : {error_message: 'Некорректная Premium-подписка.'})});
}
