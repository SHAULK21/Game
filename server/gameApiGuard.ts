import crypto from 'node:crypto';
import type {Express,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {canonicalJson} from '../src/utils/canonicalJson';
import {GameStore} from './gameStore';
import {withGameTransaction} from './gameTransactions';
/** Old economic endpoints participate in the same character transaction. Their
 * replies are receipts, never instructions for the browser to award currency. */
export function registerGameApiGuard(app:Express,getPool:()=>Pool,auth:RequestHandler) {
 const guarded=(path:string)=>/^\/api\/(?:items\/|market\/|clan\/|clans\/|pvp\/|referrals\/check)/.test(path)&&!/^\/api\/(?:clan\/(?:chat|donate)$|market\/residents\/demand)/.test(path);
 app.use((req,res,next)=>{
  if(!guarded(req.path)||['GET','HEAD'].includes(req.method))return next();
  void (async()=>{
   // Authenticate first, then lock; the downstream route reuses the verified ID.
   await new Promise<void>((resolve,reject)=>{const result=auth(req,res,(error?:any)=>error?reject(error):resolve());Promise.resolve(result).then(()=>{if(res.headersSent)resolve();}).catch(reject);});
   if(res.headersSent)return;
   const client=await getPool().connect();let completed=false;
   const original=res.json.bind(res);
   try {
    await client.query('BEGIN');
    const owner=req.authUser!.id, row=(await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE',[owner])).rows[0];
    if(row.character_authority!=='server-actions-v1') {await client.query('ROLLBACK');res.status(409);original({code:'CANONICAL_REQUIRED',error:'Обновите игру и перенесите персонажа на сервер.',outcome:'rejected'});return;}
    const token=req.get('X-Game-Session')||'',generation=Number(req.get('X-Game-Generation')),epoch=Number(req.get('X-Game-Reset-Version')),version=Number(req.get('X-Game-Version')),id=req.get('X-Game-Operation')||'';
    const fail=(code:string,error:string)=>{res.status(409);return {code,error};};
    if(row.reset_version!==epoch) {await client.query('ROLLBACK');original(fail('ACCOUNT_RESET','Прогресс сброшен.'));return;}
    if(row.progress_session_hash!==crypto.createHash('sha256').update(token).digest('hex')||Number(row.progress_session_generation)!==generation) {await client.query('ROLLBACK');original(fail('SESSION_LOST','Активная сессия перенесена.'));return;}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!Number.isSafeInteger(version)) {await client.query('ROLLBACK');original(fail('INVALID_OPERATION','Обновите игру перед действием.'));return;}
    const hash=crypto.createHash('sha256').update(canonicalJson({path:req.path,body:req.body,epoch})).digest('hex');
    const cached=(await client.query('SELECT * FROM progress_api_operations WHERE telegram_id=$1 AND operation_id=$2',[owner,id])).rows[0];
    if(cached&&cached.request_hash!==hash) {await client.query('ROLLBACK');original(fail('OPERATION_CONFLICT','Параметры повторного запроса изменились.'));return;}
    if(!cached&&Number(row.progress_version)!==version) {await client.query('ROLLBACK');original(fail('VERSION_CONFLICT','Загрузите актуальное состояние.'));return;}
    const store=new GameStore(getPool());
    if(cached){const stored=cached.response_json;const latest=await store.projectLocked(client,req.authUser!,token);await client.query('COMMIT');res.status(stored.statusCode);original({...stored.body,_progress:latest,_operation:{id,outcome:stored.outcome,result:stored.body,replayed:true}});return;}
    const frame=await store.projectLocked(client,req.authUser!,token);
    const refuse=async(code:string,error:string,status=409)=>{
      const body={code,error},receipt={receiptVersion:2,outcome:'rejected',statusCode:status,body};
      await client.query('INSERT INTO progress_api_operations(telegram_id,operation_id,reset_version,request_hash,response_json) VALUES($1,$2,$3,$4,$5::jsonb)',[owner,id,epoch,hash,JSON.stringify(receipt)]);
      const latest=await store.projectLocked(client,req.authUser!,token);await client.query('COMMIT');completed=true;res.status(status);original({...body,_progress:latest,_operation:{id,outcome:'rejected',result:body,replayed:false}});
    };
    if(req.path!=='/api/referrals/check'&&(frame.expeditions?.active?.selection.crew==='personal' || frame.save?.player.worldPlace!=='settlement'||frame.save.player.worldJourney)) {await refuse('SETTLEMENT_REQUIRED','Для этого действия сначала вернитесь в поселение.');return;}
    if(req.path==='/api/clan/create')req.body={...req.body,gold:frame.save!.player.gold};
    if(req.path==='/api/market/residents'){
     if(!/^[0-9a-f-]{36}$/i.test(req.body?.itemId||'')){await refuse('ITEM_CHANGED','Предмет больше не находится в сумке.',400);return;}
     const item=(await client.query('SELECT * FROM owned_items WHERE owner_telegram_id=$1 AND id=$2',[owner,req.body?.itemId])).rows[0];
     if(!item){await refuse('ITEM_CHANGED','Предмет больше не находится в сумке.',400);return;}
     req.body={...req.body,item:{...item.item_json,id:item.id,stackCount:item.quantity,serverOwned:true}};
    }
    await client.query('INSERT INTO game_ledger_ids(telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING',[owner]);
    await client.query('SAVEPOINT legacy_api_action');
    await withGameTransaction(client,()=>new Promise<void>((resolve,reject)=>{
     res.json=((body:any)=>{
      void (async()=>{
       let outcome=res.statusCode<400?'applied':'rejected';
       try {if(outcome==='applied'){
        const current=(await client.query('SELECT progress_json FROM players WHERE telegram_id=$1',[owner])).rows[0].progress_json;
        const disposed=/^\/api\/items\/(?:bulk-dispose|[^/]+\/dispose)$/.test(req.path);
        if(req.path==='/api/clan/create')current.player.gold-=body.priceGold;
        if(req.path==='/api/market/residents'||disposed){current.player.gold+=Number(body.gold||0);current.player.silver+=Number(body.silver||0);}
        if(disposed&&body.ore>0){
         const item={templateId:'iron_ore',name:'Железная руда',type:'ore',rarity:'common',level:1,stats:{},upgradeLevel:0,sellPrice:12,icon:'⚪',disassembleYield:{ore:1}};
         const rows=(await client.query('SELECT id,item_json,quantity FROM owned_items WHERE owner_telegram_id=$1 AND equipped_slot IS NULL FOR UPDATE',[owner])).rows;
         const stack=rows.find(row=>row.item_json.templateId==='iron_ore'&&Number(row.quantity)+body.ore<=2147483647);
         if(stack)await client.query('UPDATE owned_items SET quantity=quantity+$2 WHERE id=$1',[stack.id,body.ore]);
         else{if(rows.length>=current.player.maxInventorySlots||!Number.isSafeInteger(body.ore)||body.ore>2147483647)throw new Error('Освободите место в сумке для материалов.');
          await client.query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin,character_id) VALUES($1,$2::jsonb,$3,'game_command',$4)",[owner,JSON.stringify(item),body.ore,current.player.id]);}

        }
        if(!Number.isSafeInteger(current.player.gold)||current.player.gold<0||current.player.gold>2147483647||!Number.isSafeInteger(current.player.silver)||current.player.silver<0||current.player.silver>2147483647)throw new Error('Баланс превышает допустимый предел.');
        await client.query('UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1,progress_migration_open=FALSE WHERE telegram_id=$1',[owner,JSON.stringify(current)]);
       }
       } catch(error) {outcome='rejected';res.status(400);body={code:'ACTION_REJECTED',error:error instanceof Error?error.message:'Действие не выполнено.'};}
       if(outcome==='rejected')await client.query('ROLLBACK TO SAVEPOINT legacy_api_action');
       await client.query('RELEASE SAVEPOINT legacy_api_action');
       const receipt={receiptVersion:2,outcome,statusCode:res.statusCode,body};
       await client.query('INSERT INTO progress_api_operations(telegram_id,operation_id,reset_version,request_hash,response_json) VALUES($1,$2,$3,$4,$5::jsonb)',[owner,id,epoch,hash,JSON.stringify(receipt)]);
       const latest=await store.projectLocked(client,req.authUser!,token);
       await client.query('COMMIT');completed=true;
       original({...body,_progress:latest,_operation:{id,outcome,result:body,replayed:false}});resolve();
      })().catch(reject);
      return res;
     }) as typeof res.json;
     next();
    }));
   } catch(error) {if(!completed)await client.query('ROLLBACK').catch(()=>{});res.json=original;if(!res.headersSent)res.status(503).json({code:'RESULT_UNKNOWN',error:'Результат пока неизвестен. Восстановите запрос.'});}
   finally{client.release();res.json=original;}
  })().catch(()=>{if(!res.headersSent)res.status(503).json({code:'RESULT_UNKNOWN',error:'Сервер временно недоступен.'});});
 });
}
