import {bulkReward,matchesBulkItem} from '../src/utils/bulkInventory';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Request, Response, NextFunction } from 'express';
import { ProgressError } from './progressValidation';
import { projectProgress } from './progressStore';

const transactions=new AsyncLocalStorage<PoolClient>();
/** Existing route transactions become savepoints inside the character transaction. */
export function progressAwarePool(pool:Pool):Pool {
 return new Proxy(pool,{get(target,key){
  if(key==='query')return(...args:any[])=>{const client=transactions.getStore();return client?(client.query as any)(...args):(target.query as any)(...args);};
  if(key==='connect')return async()=>{
   const client=transactions.getStore();if(!client)return target.connect();
   const name='nested_'+crypto.randomBytes(8).toString('hex');let started=false;
   return {query:async(sql:any,args?:any[])=>{
    if(typeof sql==='string' && /^BEGIN\s*;?$/i.test(sql)){started=true;return client.query('SAVEPOINT '+name);}
    if(typeof sql==='string' && /^COMMIT\s*;?$/i.test(sql)){started=false;return client.query('RELEASE SAVEPOINT '+name);}
    if(typeof sql==='string' && /^ROLLBACK\s*;?$/i.test(sql)){if(started){started=false;await client.query('ROLLBACK TO SAVEPOINT '+name);return client.query('RELEASE SAVEPOINT '+name);}return {rows:[],rowCount:0};}
    return client.query(sql,args);
   },release(){}};
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }}) as Pool;
}
export const isProgressApiMutation=(path:string,method:string)=>!['GET','HEAD'].includes(method) &&
 /^\/api\/(?:items(?:\/|$)|market(?:\/|$)|clan(?:\/|$)|pvp(?:\/|$))/.test(path) && !/\/chat$/.test(path);
const digest=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');

/** Hold the writer lock through legacy route work, reward application and durable receipt. */
export async function guardProgressTransaction(pool:Pool,req:Request,res:Response,next:NextFunction) {
 const token=String(req.get('X-Game-Session')||'');
 const expected=Number(req.get('X-Game-Save-Version'));
 const operation=String(req.get('X-Game-Operation')||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation))throw new ProgressError('INVALID_OPERATION','Нужен ID операции.',400);
 const requestHash=digest(JSON.stringify({path:req.path,body:req.body,epoch:req.get('X-Game-Reset-Version')}));
 const client=await pool.connect();
 const original=res.json.bind(res);
 let complete=false;
 let release=()=>{if(!complete){complete=true;client.release();}};
 try{
  await client.query('BEGIN');
  let row=(await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE',[req.authUser!.id])).rows[0];
  if(Number(row.reset_version)!==Number(req.get('X-Game-Reset-Version')||0))throw new ProgressError('ACCOUNT_RESET','Прогресс сброшен администратором.');
  if(!row.progress_json)throw new ProgressError('NO_CHARACTER','Загрузите серверного персонажа.');
  if(!token || row.progress_session_hash!==digest(token))throw new ProgressError('SESSION_LOST','Активная сессия перенесена.');
  const cached=(await client.query('SELECT * FROM progress_api_operations WHERE telegram_id=$1 AND operation_id=$2',[row.telegram_id,operation])).rows[0];
  if(cached){
   if(cached.request_hash!==requestHash || Number(cached.reset_version)!==Number(row.reset_version))throw new ProgressError('OPERATION_CONFLICT','Повторный запрос изменился.');
   const envelope=await projectProgress(client,row,token);await client.query('COMMIT');release();original({...cached.response_json,_progress:envelope});return;
  }
  if(!Number.isSafeInteger(expected)||expected!==Number(row.progress_version))throw new ProgressError('VERSION_CONFLICT','Версия сохранения изменилась.');
  // Preserve IDs even when the operation deletes or transfers the row.
  await client.query('INSERT INTO progress_ledger_ids (telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING',[row.telegram_id]);
  let localBulk={gold:0,silver:0,ore:0,count:0};
  if(req.path==='/api/items/bulk-dispose'){
    const ids=req.body.localItemIds ?? [];
    if(!Array.isArray(ids)||ids.length>500||ids.some((id:any)=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new ProgressError('INVALID_ITEMS','Некорректный список предметов.',400);
    const items=row.progress_json.player.inventory.filter((i:any)=>ids.includes(i.id));
    if(items.length!==ids.length || items.some((i:any)=>i.serverOwned || !matchesBulkItem(i,req.body.filters)))throw new ProgressError('INVALID_ITEMS','Выбранные предметы изменились.',400);
    localBulk=bulkReward(items,req.body.action);
    row.progress_json.player.inventory=row.progress_json.player.inventory.filter((i:any)=>!ids.includes(i.id));
  }
  if(req.path==='/api/clan/create')req.body.gold=row.progress_json.player.gold;
  // Local resident sales consume the authoritative JSON item rather than client price/quantity.
  if(req.path==='/api/market/residents' && !req.body.itemId){
   const save=structuredClone(row.progress_json);const item=save.player.inventory.find((i:any)=>i.id===req.body.item?.id);
   const quantity=Number(req.body.quantity);
   if(!item||item.isLocked||item.isEquipped||item.boundToClan||!Number.isInteger(quantity)||quantity<1||quantity>(item.stackCount||1))throw new ProgressError('INVALID_ITEM','Предмет недоступен.',400);
   req.body.item=structuredClone(item);
   if(quantity===(item.stackCount||1))save.player.inventory=save.player.inventory.filter((i:any)=>i.id!==item.id);
   else item.stackCount-=quantity;
   row.progress_json=save;
  }
  const respond=async(body:any)=>{
   try{
    if(res.statusCode>=400){await client.query('ROLLBACK');release();original(body);return;}
    const save=row.progress_json;
    // Route results and wallet consumption are persisted before sending ANY response.
    if(req.path==='/api/market/residents'||req.path==='/api/items/bulk-dispose'||/^\/api\/items\/[^/]+\/dispose$/.test(req.path)){
     save.player.gold+=Number(body.gold||0)+localBulk.gold;save.player.silver+=Number(body.silver||0)+localBulk.silver;
     const ore=Number(body.ore||0)+localBulk.ore;
     if(ore>0){const item=save.player.inventory.find((i:any)=>i.templateId==='iron_ore'&&!i.serverOwned);if(item && (item.stackCount||1)+ore<=999)item.stackCount=(item.stackCount||1)+ore;else save.player.inventory.push({id:crypto.randomUUID(),templateId:'iron_ore',name:'Железная руда',type:'ore',rarity:'common',level:1,upgradeLevel:0,icon:'⚪',stats:{},sellPrice:12,disassembleYield:{ore:1},stackCount:ore});}
    }
    if(req.path==='/api/clan/create'){
     if(save.player.gold<Number(body.priceGold))throw new ProgressError('NO_GOLD','Недостаточно серверного золота.',400);
     save.player.gold-=Number(body.priceGold);delete save.player.reservedClanCreationOperation;save.player.lastClanCreationOperation=req.body.operationId;
    }
    // Maintain old replay markers so local retry journals cannot apply a receipt again after reload.
    if(req.path==='/api/market/residents')save.player.lastResidentSaleOperation=req.body.operationId;
    if(req.path==='/api/items/bulk-dispose')save.player.lastBulkDisposalId=req.body.operationId;
    if(req.path==='/api/market/list')save.player.lastMarketListingOperation=req.body.operationId;
    row=(await client.query('UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1,progress_migration_open=FALSE WHERE telegram_id=$1 RETURNING *',[row.telegram_id,JSON.stringify(save)])).rows[0];
    await client.query('INSERT INTO progress_api_operations (telegram_id,operation_id,reset_version,request_hash,response_json) VALUES ($1,$2,$3,$4,$5::jsonb)',[row.telegram_id,operation,row.reset_version,requestHash,JSON.stringify(body)]);
    await client.query('INSERT INTO progress_ledger_ids (telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING',[row.telegram_id]);
    const envelope=await projectProgress(client,row,token);
    await client.query('COMMIT');release();original({...body,_progress:envelope});
   }catch(error){await client.query('ROLLBACK');release();res.json=original;next(error);}
  };
  res.json=((body:any)=>{void respond(body);return res;}) as any;
  // A disconnected client may still commit; its durable receipt makes the retry safe.
  // Errors forwarded by express-async-errors are answered by the error middleware using the intercepted json.
  transactions.run(client,()=>next());
 }catch(error){await client.query('ROLLBACK');release();throw error;}
}
