import { registerBalanceTelemetry } from './balanceTelemetry';
import {registerAdminBroadcasts} from './broadcasts';
import type { Express, RequestHandler } from 'express';
import type { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import { canAssignRole, canManageMember, canUseVault, CLAN_ROLE_LABELS, type ClanRole } from '../src/utils/clanRoles';
import { PVP_CLASSES, PVP_STANCES, pvpRatingDelta, simulateDuel } from '../src/utils/pvp';
import type { PvpStance } from '../src/utils/pvp';
import { nextArenaReset, ENERGY_REGEN_MS } from '../src/utils/gameCadence';

type TelegramApi = <T = unknown>(method: string, payload: Record<string,unknown>) => Promise<T>;
export const NOTIFICATION_CATEGORIES = ['energy','arena','mining','market','clan','pvp','premium','referral','announcements'];
const uuid = (value:unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function queueNotification(db: Pool | PoolClient, userId: number, key:string, category:string,text:string,dueAt=new Date()) {
  await db.query(`INSERT INTO game_notifications (telegram_id,event_key,category,text,due_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (telegram_id,event_key) DO NOTHING`,[userId,key,category,text,dueAt]);
}
export function startNotificationWorker(getPool:()=>Pool, telegram:TelegramApi, enabled:boolean) {
  if (!enabled) return;
  let busy=false;
  const tick=async()=>{
    if(busy)return;busy=true;
    const client=await getPool().connect().catch(()=>null);
    if(!client){busy=false;return;}
    try {
      await client.query('BEGIN');
      const rows=await client.query(`SELECT n.*,p.notification_settings,p.bot_started FROM game_notifications n JOIN players p ON p.telegram_id=n.telegram_id WHERE n.sent_at IS NULL AND n.due_at<=NOW() AND n.next_attempt_at<=NOW() AND n.attempts<6 ORDER BY n.due_at LIMIT 10 FOR UPDATE OF n SKIP LOCKED`);
      for(const row of rows.rows) {
        if(!row.bot_started || row.notification_settings?.enabled!==true || row.notification_settings?.[row.category]===false) {
          if(row.category==='announcements'){await client.query('UPDATE game_notifications SET sent_at=NOW() WHERE id=$1',[row.id]);continue;}
          await client.query("UPDATE game_notifications SET next_attempt_at=NOW()+INTERVAL '1 hour' WHERE id=$1",[row.id]);continue;
        }
        if(row.category==='premium' && String(row.event_key).startsWith('premium_expire_')) {
          const current=await client.query('SELECT premium_until>NOW() AS active FROM players WHERE telegram_id=$1',[row.telegram_id]);
          if(current.rows[0]?.active){await client.query('UPDATE game_notifications SET sent_at=NOW(),read_at=NOW() WHERE id=$1',[row.id]);continue;}
        }
        try {
          await telegram('sendMessage',{chat_id:Number(row.telegram_id),text:row.text});
          await client.query('UPDATE game_notifications SET sent_at=NOW() WHERE id=$1',[row.id]);
        } catch(error) {
          const blocked=/blocked|chat not found|deactivated/i.test(String(error));
          await client.query("UPDATE game_notifications SET attempts=attempts+1,next_attempt_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",[row.id]);
          if(blocked) await client.query(`UPDATE players SET bot_started=FALSE WHERE telegram_id=$1`,[row.telegram_id]);
        }
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');console.error('Notification worker:',error);}finally{client.release();busy=false;}
  };
  const timer=setInterval(()=>void tick(),30000);timer.unref();void tick();
}
export function registerSocialFeatures(app:Express,getPool:()=>Pool,auth:RequestHandler,telegram:TelegramApi,baseUrl:string) {
  const admin:RequestHandler=(req,res,next)=>{
    const id=String(process.env.ADMIN_TELEGRAM_ID || process.env.VITE_ADMIN_TELEGRAM_ID || '').trim();
    if(!id || String(req.authUser!.id)!==id){res.status(403).json({error:'Только администратор.'});return;}next();
  };
  registerBalanceTelemetry(app,getPool,auth,admin);
  registerAdminBroadcasts(app,getPool,auth,admin,async()=>{const bot=await telegram<{username:string}>('getMe',{});return bot.username;});
  app.post('/api/admin/premium/self',auth,admin,async(req,res)=>{
    const days=Number(req.body?.days ?? 30),id=req.body?.operationId;
    if(!uuid(id)||!Number.isInteger(days)||days<1||days>365)return res.status(400).json({error:'Укажите 1–365 дней и ID операции.'});
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      const grant=await client.query('INSERT INTO admin_premium_grants (id,telegram_id,days) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[id,req.authUser!.id,days]);
      if(grant.rowCount) await client.query(`UPDATE players SET premium_until=GREATEST(COALESCE(premium_until,NOW()),NOW()) + $1 * INTERVAL '1 day' WHERE telegram_id=$2`,[days,req.authUser!.id]);
      const row=await client.query('SELECT premium_until FROM players WHERE telegram_id=$1',[req.authUser!.id]);
      await queueNotification(client,req.authUser!.id,'premium_expire_'+new Date(row.rows[0].premium_until).toISOString(),'premium','👑 Срок игрового Premium истёк.',new Date(row.rows[0].premium_until));
      await client.query('COMMIT');res.json({premiumUntil:row.rows[0].premium_until});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.get('/api/notifications',auth,async(req,res)=>{
    const p=(await getPool().query('SELECT notification_settings,bot_started FROM players WHERE telegram_id=$1',[req.authUser!.id])).rows[0];
    const rows=await getPool().query('SELECT id,category,text,due_at,read_at FROM game_notifications WHERE telegram_id=$1 AND due_at<=NOW() ORDER BY id DESC LIMIT 50',[req.authUser!.id]);
    res.json({settings:p.notification_settings,botStarted:p.bot_started,notifications:rows.rows});
  });
  app.post('/api/notifications/settings',auth,async(req,res)=>{
    const settings:Record<string,boolean>={enabled:req.body?.enabled===true};
    for(const key of NOTIFICATION_CATEGORIES)settings[key]=req.body?.[key]!==false;
    await getPool().query('UPDATE players SET notification_settings=$1::jsonb WHERE telegram_id=$2',[JSON.stringify(settings),req.authUser!.id]);
    res.json({settings});
  });
  app.post('/api/notifications/read',auth,async(req,res)=>{
    await getPool().query('UPDATE game_notifications SET read_at=NOW() WHERE telegram_id=$1 AND read_at IS NULL AND due_at<=NOW()',[req.authUser!.id]);res.json({ok:true});
  });
  app.post('/api/notifications/schedule',auth,async(req,res)=>{
    const id=req.authUser!.id,now=Date.now();
    const {energy,maxEnergy,regenAt,miningEndsAt}=req.body||{};
    if(!Number.isFinite(energy)||!Number.isFinite(maxEnergy)||energy<0||energy>maxEnergy||maxEnergy<1||maxEnergy>1000)return res.status(400).json({error:'Неверное состояние энергии.'});
    const schedules=[{category:'energy',due:energy<maxEnergy?Math.max(now,Math.min(now,Number(regenAt)||now)+(maxEnergy-energy)*ENERGY_REGEN_MS):null,text:'⚡ Энергия полностью восстановилась. Можно продолжить приключение!'},
      {category:'arena',due:nextArenaReset(),text:'🎟️ Настал новый день арены: доступно до 5 ежедневных билетов. Откройте игру, чтобы обновить их.'},
      {category:'mining',due:Number.isFinite(miningEndsAt)&&miningEndsAt>now&&miningEndsAt<now+86400000?miningEndsAt:null,text:'⛏️ Шахтёрская экспедиция завершена. Заберите добычу!'}];
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT telegram_id FROM players WHERE telegram_id=$1 FOR UPDATE',[id]);
      for(const entry of schedules) {
        await client.query('DELETE FROM game_notifications WHERE telegram_id=$1 AND category=$2 AND sent_at IS NULL AND read_at IS NULL',[id,entry.category]);
        if(entry.due)await queueNotification(client,id,entry.category+'_'+Math.floor(entry.due/1000),entry.category,entry.text,new Date(entry.due));
      }
      await client.query('COMMIT');res.json({ok:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.get('/api/referrals',auth,async(req,res)=>{
    const bot=await telegram<{username:string}>('getMe',{});
    const count=await getPool().query('SELECT COUNT(*)::int AS count FROM referral_rewards WHERE inviter=$1',[req.authUser!.id]);
    res.json({url:`https://t.me/${bot.username}?start=ref_${req.authUser!.id}`,rewardDays:3,requiredLevel:10,count:count.rows[0].count});
  });
  app.post('/api/referrals/check',auth,async(req,res)=>{
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(74632819)');
      // start_param comes from signed Telegram initData, not an arbitrary body ID.
      const start=new URLSearchParams(String(req.headers['x-telegram-init-data']||'')).get('start_param')||'';
      const match=start.match(/^ref_(\d+)$/);
      if(match && Number(match[1])!==req.authUser!.id) await client.query(`UPDATE players SET referred_by=$1 WHERE telegram_id=$2 AND referred_by IS NULL AND created_at>NOW()-INTERVAL '10 minutes' AND EXISTS(SELECT 1 FROM players WHERE telegram_id=$1 AND created_at<(SELECT created_at FROM players WHERE telegram_id=$2))`,[match[1],req.authUser!.id]);
      const row=(await client.query('SELECT level,referred_by FROM players WHERE telegram_id=$1 FOR UPDATE',[req.authUser!.id])).rows[0];
      let rewarded=false;
      if(row.level>=10 && row.referred_by) {
        const claim=await client.query('INSERT INTO referral_rewards (invitee,inviter) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING invitee',[req.authUser!.id,row.referred_by]);
        if(claim.rowCount){
          // Consistent ID ordering prevents reciprocal grant deadlocks.
          for(const id of [Number(row.referred_by),req.authUser!.id].sort((a,b)=>a-b)) {
            await client.query(`UPDATE players SET premium_until=GREATEST(COALESCE(premium_until,NOW()),NOW())+INTERVAL '3 days' WHERE telegram_id=$1`,[id]);
            await queueNotification(client,id,'referral_'+req.authUser!.id,'referral','🎁 Друг достиг 10 уровня! Вам начислен игровой Premium на 3 дня.');
          }
          const expiry=await client.query('SELECT telegram_id,premium_until FROM players WHERE telegram_id=ANY($1::bigint[])',[[Number(row.referred_by),req.authUser!.id]]);
          for(const p of expiry.rows)await queueNotification(client,p.telegram_id,'premium_expire_'+new Date(p.premium_until).toISOString(),'premium','👑 Срок игрового Premium истёк.',new Date(p.premium_until));
          rewarded=true;
        }
      }
      await client.query('COMMIT');res.json({rewarded});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  const clanAction:RequestHandler=async(req,res)=>{
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      const clan=(await client.query(`SELECT c.* FROM clans c JOIN clan_members m ON m.clan_id=c.id WHERE m.telegram_id=$1 FOR UPDATE OF c`,[req.authUser!.id])).rows[0];
      if(!clan)throw new Error('Вы не состоите в клане.');
      const members=(await client.query('SELECT * FROM clan_members WHERE clan_id=$1 ORDER BY telegram_id FOR UPDATE',[clan.id])).rows;
      const actor=members.find(m=>String(m.telegram_id)===String(req.authUser!.id));
      const target=members.find(m=>String(m.telegram_id)===String(req.body?.targetId));
      const action=req.body?.action;let text='';
      if(action==='settings') {
        if(!['owner','officer'].includes(actor.role))throw new Error('Настройки доступны главе и офицерам.');
        const min=Number(req.body.minLevel);
        if(!Number.isInteger(min)||min<1||min>120||typeof req.body.open!=='boolean'||typeof req.body.description!=='string'||req.body.description.length>280)throw new Error('Проверьте описание и уровень 1–120.');
        await client.query('UPDATE clans SET description=$1,recruitment_open=$2,min_join_level=$3 WHERE id=$4',[req.body.description,req.body.open,min,clan.id]);text='Обновлены правила набора и описание.';
      } else if(action==='role') {
        if(!target||!canAssignRole(actor.role,target.role,req.body.role))throw new Error('Недостаточно прав для смены роли.');
        await client.query('UPDATE clan_members SET role=$1 WHERE clan_id=$2 AND telegram_id=$3',[req.body.role,clan.id,target.telegram_id]);text=`Роль ${target.telegram_id}: ${req.body.role}.`;
        await queueNotification(client,target.telegram_id,'clan_role_'+crypto.randomUUID(),'clan',`В клане ${clan.name} изменена ваша роль: ${CLAN_ROLE_LABELS[req.body.role as ClanRole]}.`);
      } else if(action==='kick') {
        if(!target||!canManageMember(actor.role,target.role))throw new Error('Недостаточно прав для исключения.');
        await client.query('DELETE FROM clan_members WHERE clan_id=$1 AND telegram_id=$2',[clan.id,target.telegram_id]);
        await client.query('UPDATE players SET clan_id=NULL WHERE telegram_id=$1',[target.telegram_id]);text=`Исключён игрок ${target.telegram_id}.`;
        await queueNotification(client,target.telegram_id,'clan_kick_'+crypto.randomUUID(),'clan',`Вы исключены из клана ${clan.name}.`);
      } else if(action==='transfer') {
        if(actor.role!=='owner'||!target||target.telegram_id===actor.telegram_id)throw new Error('Передать руководство может только глава другому участнику.');
        await client.query("UPDATE clan_members SET role=CASE WHEN telegram_id=$1 THEN 'owner' ELSE 'officer' END WHERE clan_id=$2 AND telegram_id=ANY($3::bigint[])",[target.telegram_id,clan.id,[target.telegram_id,actor.telegram_id]]);
        await client.query('UPDATE clans SET owner_telegram_id=$1 WHERE id=$2',[target.telegram_id,clan.id]);text=`Руководство передано ${target.telegram_id}.`;
      } else if(action==='upgrade') {
        if(actor.role!=='owner')throw new Error('Улучшение доступно главе.');
        const cost=1000*Number(clan.level);
        if(Number(clan.level)>=15||Number(clan.treasury_gold)<cost)throw new Error(`Нужны ${cost} золота в казне; предел — 15 уровень.`);
        await client.query('UPDATE clans SET treasury_gold=treasury_gold-$1,level=level+1,max_members=LEAST(50,max_members+2) WHERE id=$2',[cost,clan.id]);text='Клан улучшен: +2 места.';
      } else throw new Error('Неизвестное действие.');
      await client.query('INSERT INTO clan_management_events (clan_id,actor,text) VALUES ($1,$2,$3)',[clan.id,req.authUser!.id,text]);
      await client.query('COMMIT');res.json({ok:true});
    }catch(error){await client.query('ROLLBACK');res.status(400).json({error:error instanceof Error?error.message:'Действие не выполнено.'});}finally{client.release();}
  };
  app.post('/api/clan/manage',auth,clanAction);
  app.get('/api/clan/events',auth,async(req,res)=>{
    const result=await getPool().query(`SELECT e.text,e.created_at FROM clan_management_events e JOIN clan_members m ON m.clan_id=e.clan_id WHERE m.telegram_id=$1 ORDER BY e.id DESC LIMIT 30`,[req.authUser!.id]);res.json({events:result.rows});
  });
  app.post('/api/clan/storage/:itemId/give',auth,async(req,res)=>{
    const target=Number(req.body?.targetId);
    if(!Number.isSafeInteger(target)||!uuid(req.params.itemId))return res.status(400).json({error:'Выберите вещь и участника.'});
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      const clan=(await client.query('SELECT c.id FROM clans c JOIN clan_members m ON m.clan_id=c.id WHERE m.telegram_id=$1 FOR UPDATE OF c',[req.authUser!.id])).rows[0];
      if(!clan)throw new Error('Клан не найден.');
      const members=(await client.query('SELECT telegram_id,role FROM clan_members WHERE clan_id=$1 FOR SHARE',[clan.id])).rows;
      const actor=members.find(m=>String(m.telegram_id)===String(req.authUser!.id));
      if(!canUseVault(actor?.role)||!members.some(m=>String(m.telegram_id)===String(target)))throw new Error('Недостаточно прав или получатель не в клане.');
      const item=(await client.query('SELECT * FROM owned_items WHERE id=$1 AND clan_id=$2 FOR UPDATE',[req.params.itemId,clan.id])).rows[0];
      if(!item)throw new Error('Предмет уже забрали.');
      await client.query('UPDATE owned_items SET owner_telegram_id=$1,clan_id=NULL,updated_at=NOW() WHERE id=$2',[target,item.id]);
      await client.query(`INSERT INTO clan_storage_events (clan_id,actor_telegram_id,action,item_name,quantity) VALUES ($1,$2,'give',$3,$4)`,[clan.id,req.authUser!.id,item.item_json.name,item.quantity]);
      await queueNotification(client,target,'clan_give_'+item.id+'_'+Date.now(),'clan',`🎒 Из кланового склада вам выдано: ${item.item_json.name} ×${item.quantity}.`);
      await client.query('COMMIT');res.json({ok:true});
    }catch(error){await client.query('ROLLBACK');res.status(400).json({error:error instanceof Error?error.message:'Не удалось выдать предмет.'});}finally{client.release();}
  });
  app.get('/api/pvp',auth,async(req,res)=>{
    const id=req.authUser!.id;
    await getPool().query('INSERT INTO pvp_profiles (telegram_id) VALUES ($1) ON CONFLICT DO NOTHING',[id]);
    await getPool().query(`UPDATE pvp_profiles SET tickets=5,ticket_day=(NOW() AT TIME ZONE 'UTC')::date WHERE telegram_id=$1 AND ticket_day<(NOW() AT TIME ZONE 'UTC')::date`,[id]);
    const profile=(await getPool().query('SELECT * FROM pvp_profiles WHERE telegram_id=$1',[id])).rows[0];
    const opponents=await getPool().query(`SELECT v.telegram_id,v.rating,v.stance,p.class_id,COALESCE(p.character_name,p.display_name) AS name FROM pvp_profiles v JOIN players p ON p.telegram_id=v.telegram_id WHERE v.enrolled AND v.telegram_id<>$1 AND ABS(v.rating-$2)<=400 AND (p.clan_id IS NULL OR p.clan_id IS DISTINCT FROM (SELECT clan_id FROM players WHERE telegram_id=$1)) AND NOT EXISTS(SELECT 1 FROM pvp_matches m WHERE ((m.attacker=$1 AND m.defender=v.telegram_id) OR (m.defender=$1 AND m.attacker=v.telegram_id)) AND m.created_at>NOW()-INTERVAL '24 hours') ORDER BY ABS(v.rating-$2),v.telegram_id LIMIT 10`,[id,profile.rating]);
    const history=await getPool().query(`SELECT id,attacker,defender,result,created_at FROM pvp_matches WHERE attacker=$1 OR defender=$1 ORDER BY created_at DESC LIMIT 10`,[id]);
    const leaders=await getPool().query(`SELECT v.rating,v.wins,COALESCE(p.character_name,p.display_name) AS name FROM pvp_profiles v JOIN players p ON p.telegram_id=v.telegram_id WHERE v.enrolled ORDER BY v.rating DESC,v.wins DESC,v.telegram_id LIMIT 20`);
    res.json({profile,opponents:opponents.rows,history:history.rows,leaders:leaders.rows,starsEnabled:false,resetAt:new Date(nextArenaReset()).toISOString()});
  });
  app.post('/api/pvp/enroll',auth,async(req,res)=>{
    if(!PVP_STANCES.includes(req.body?.stance)||typeof req.body?.enrolled!=='boolean')return res.status(400).json({error:'Выберите тактику и участие.'});
    await getPool().query(`INSERT INTO pvp_profiles (telegram_id,stance,enrolled) VALUES ($1,$2,$3) ON CONFLICT (telegram_id) DO UPDATE SET stance=$2,enrolled=$3`,[req.authUser!.id,req.body.stance,req.body.enrolled]);res.json({ok:true});
  });
  app.post('/api/pvp/challenge',auth,async(req,res)=>{
    const id=req.authUser!.id,target=Number(req.body?.targetId),matchId=req.body?.matchId;
    if(!uuid(matchId)||!Number.isSafeInteger(target)||target===id)return res.status(400).json({error:'Неверный соперник или ID боя.'});
    if(req.body?.stars)return res.status(400).json({error:'Бои со ставками Stars отключены.'});
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[matchId]);
      const cached=(await client.query('SELECT * FROM pvp_matches WHERE id=$1',[matchId])).rows[0];
      if(cached){if(String(cached.attacker)!==String(id)||String(cached.defender)!==String(target))throw new Error('ID боя уже используется.');await client.query('COMMIT');return res.json(cached.result);}
      const profiles=(await client.query(`SELECT v.*,p.class_id,p.clan_id,COALESCE(p.character_name,p.display_name) AS name FROM pvp_profiles v JOIN players p ON p.telegram_id=v.telegram_id WHERE v.telegram_id=ANY($1::bigint[]) ORDER BY v.telegram_id FOR UPDATE OF v`,[[id,target]])).rows;
      const a=profiles.find(p=>String(p.telegram_id)===String(id)),b=profiles.find(p=>String(p.telegram_id)===String(target));
      if(!a?.enrolled||!b?.enrolled)throw new Error('Оба игрока должны включить участие в PvP.');
      if(a.clan_id&&a.clan_id===b.clan_id)throw new Error('Соклановцы не участвуют в рейтинговых дуэлях между собой.');
      if(Math.abs(a.rating-b.rating)>400)throw new Error('Разница рейтинга слишком большая.');
      if(a.last_fight_at && Date.now()-new Date(a.last_fight_at).getTime()<60000)throw new Error('Между боями нужна минута отдыха.');
      const today=new Date().toISOString().slice(0,10);
      const day = a.ticket_day instanceof Date ? a.ticket_day.toISOString().slice(0,10) : String(a.ticket_day).slice(0,10);
      const tickets=day===today?Number(a.tickets):5;
      if(tickets<1)throw new Error('Попытки PvP закончились до 00:00 UTC.');
      const recent=await client.query(`SELECT id FROM pvp_matches WHERE ((attacker=$1 AND defender=$2) OR (attacker=$2 AND defender=$1)) AND created_at>NOW()-INTERVAL '24 hours' LIMIT 1`,[id,target]);
      if(recent.rowCount)throw new Error('С этим соперником можно сразиться раз в 24 часа.');
      const classOf=(c:string)=>PVP_CLASSES.includes(c as any)?c:'warrior';
      const duel=simulateDuel({classId:classOf(a.class_id),name:a.name,stance:a.stance as PvpStance},{classId:classOf(b.class_id),name:b.name,stance:b.stance as PvpStance},()=>crypto.randomInt(1000000)/1000000);
      const delta=pvpRatingDelta(Number(a.rating),Number(b.rating),duel.winner as any);
      const aRating=Math.max(0,Number(a.rating)+delta),bRating=Math.max(0,Number(b.rating)-delta);
      await client.query(`UPDATE pvp_profiles SET rating=$2,tickets=$3,ticket_day=$4,last_fight_at=NOW(),wins=wins+$5,losses=losses+$6 WHERE telegram_id=$1`,[id,aRating,tickets-1,today,duel.winner==='attacker'?1:0,duel.winner==='defender'?1:0]);
      await client.query(`UPDATE pvp_profiles SET rating=$2,wins=wins+$3,losses=losses+$4 WHERE telegram_id=$1`,[target,bRating,duel.winner==='defender'?1:0,duel.winner==='attacker'?1:0]);
      const result={...duel,matchId,attackerName:a.name,defenderName:b.name,attackerRating:aRating,defenderRating:bRating,delta};
      await client.query('INSERT INTO pvp_matches (id,attacker,defender,result) VALUES ($1,$2,$3,$4::jsonb)',[matchId,id,target,JSON.stringify(result)]);
      await queueNotification(client,target,'pvp_'+matchId,'pvp',`⚔️ ${a.name} вызвал вас на дуэль. ${duel.winner==='draw'?'Ничья':duel.winner==='defender'?'Вы победили':'Вы проиграли'}. Ваш рейтинг: ${bRating}.`);
      await client.query('COMMIT');res.json(result);
    }catch(error){await client.query('ROLLBACK');res.status(400).json({error:error instanceof Error?error.message:'Не удалось провести бой.'});}finally{client.release();}
  });
}
