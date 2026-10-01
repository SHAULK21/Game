import type {Express,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {BROADCAST_AUDIENCES,NOTIFICATION_TEMPLATES,renderBroadcast,type BroadcastAudience} from '../src/utils/notificationTemplates';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const audienceCondition:Record<BroadcastAudience,string>={all:'TRUE',premium:'premium_until > NOW()',regular:'(premium_until IS NULL OR premium_until <= NOW())',active:"updated_at >= NOW() - INTERVAL '7 days'"};
const telegramEligible = "bot_started AND notification_settings->>'enabled' = 'true' AND COALESCE(notification_settings->>'announcements','true') <> 'false'";
export async function broadcastSummary(pool:Pool) {
 const audiences:Record<string,{players:number;telegram:number}>={};
 for(const audience of Object.keys(BROADCAST_AUDIENCES) as BroadcastAudience[]){
  const row=(await pool.query(`SELECT COUNT(*)::int AS players,COUNT(*) FILTER (WHERE ${telegramEligible})::int AS telegram FROM players WHERE ${audienceCondition[audience]}`)).rows[0];
  audiences[audience]={players:Number(row.players),telegram:Number(row.telegram)};
 }
 const recent=await pool.query('SELECT id,template_id,audience,players_count,telegram_count,created_at FROM admin_broadcasts ORDER BY created_at DESC LIMIT 10');
 return {templates:NOTIFICATION_TEMPLATES,audiences,recent:recent.rows};
}
export async function createAdminBroadcast(pool:Pool,adminId:number,body:any,getBotUsername:()=>Promise<string>) {
 const {operationId,templateId,audience,details=''}=body||{};
 if(!uuid(operationId)||!Object.hasOwn(BROADCAST_AUDIENCES,String(audience)))throw new Error('Выберите аудиторию и ID операции.');
 const text=renderBroadcast(templateId,details);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[operationId]);
  const previous=(await client.query('SELECT * FROM admin_broadcasts WHERE id=$1',[operationId])).rows[0];
  if(previous){
   if(String(previous.admin_id)!==String(adminId)||previous.template_id!==templateId||previous.audience!==audience||previous.text!==text)throw new Error('Параметры повторной рассылки не совпадают.');
   await client.query('COMMIT');return {id:previous.id,players:Number(previous.players_count),telegram:Number(previous.telegram_count),replayed:true};
  }
  let referralPrefix='';
  if(templateId==='referral'){
   const username=await getBotUsername();
   if(!/^[a-zA-Z0-9_]+$/.test(username))throw new Error('Не удалось получить ссылку игрового бота.');
   referralPrefix=`\n\nВаша ссылка для друга: https://t.me/${username}?start=ref_`;
  }
  // One statement snapshots recipients and queues the personalized message atomically.
  // Players without Telegram permission still see the announcement in the in-game feed.
  const sent=await client.query(`WITH recipients AS (
   SELECT telegram_id,COALESCE((${telegramEligible}),FALSE) AS eligible FROM players WHERE ${audienceCondition[audience as BroadcastAudience]}
  ), queued AS (
   INSERT INTO game_notifications (telegram_id,event_key,category,text,sent_at)
   SELECT telegram_id,$1,'announcements',$2 || CASE WHEN $3 <> '' THEN $3 || telegram_id::text ELSE '' END,
          CASE WHEN eligible THEN NULL ELSE NOW() END FROM recipients
   ON CONFLICT (telegram_id,event_key) DO NOTHING RETURNING telegram_id,sent_at
  ) SELECT COUNT(*)::int AS players,COUNT(*) FILTER (WHERE sent_at IS NULL)::int AS telegram FROM queued`,['broadcast_'+operationId,text,referralPrefix]);
  const {players,telegram}=sent.rows[0];
  await client.query('INSERT INTO admin_broadcasts (id,admin_id,template_id,audience,text,players_count,telegram_count) VALUES ($1,$2,$3,$4,$5,$6,$7)',[operationId,adminId,templateId,audience,text,players,telegram]);
  await client.query('COMMIT');return {id:operationId,players:Number(players),telegram:Number(telegram),replayed:false};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export function registerAdminBroadcasts(app:Express,getPool:()=>Pool,auth:RequestHandler,admin:RequestHandler,getBotUsername:()=>Promise<string>){
 app.get('/api/admin/broadcasts',auth,admin,async(_req,res)=>res.json(await broadcastSummary(getPool())));
 app.post('/api/admin/broadcasts',auth,admin,async(req,res)=>{
  try{res.json(await createAdminBroadcast(getPool(),req.authUser!.id,req.body,getBotUsername));}
  catch(error){res.status(400).json({error:error instanceof Error?error.message:'Не удалось создать рассылку.'});}
 });
}
