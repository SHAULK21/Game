import type {RequestHandler} from 'express';
/** No wallet changes; a definitive refusal is safe to remove from the retry journal. */
export const unavailableClanDonation:RequestHandler=(_req,res)=>{
 res.status(501).json({code:'FEATURE_UNAVAILABLE',outcome:'rejected',error:'Пожертвования временно недоступны. Казна ещё не подключена к серверному кошельку.'});
};
