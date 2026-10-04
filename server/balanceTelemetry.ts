import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {registerPlayerAnalytics} from './playerAnalytics';
const uuid=(v:unknown)=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const integer=(v:unknown,min:number,max:number)=>typeof v==='number' && Number.isInteger(v) && v>=min && v<=max;
export function validTelemetryEvent(e:any):boolean {
  if(!e || !uuid(e.id) || !integer(e.level,1,10000) || !integer(e.durationMs,0,86400000))return false;
  if(e.kind==='session')return integer(e.sequence,1,1000000) && integer(e.netGold,-1000000000,1000000000) && integer(e.netSilver,-1000000000,1000000000)
    && (e.startLevel===undefined||integer(e.startLevel,1,10000))
    && (e.maxLevel===undefined||(integer(e.maxLevel,e.level,10000)&&e.maxLevel>=(e.startLevel||1)))
    && (e.screen===undefined||(typeof e.screen==='string'&&/^[a-z_]{1,30}$/.test(e.screen)))
    && (e.state===undefined||['idle','combat','victory','defeat','flee','dungeon'].includes(e.state))
    && (e.energy===undefined||integer(e.energy,0,1000));
  if(e.kind!=='battle' || !uuid(e.sessionId) || !['victory','defeat','flee'].includes(e.outcome) || !integer(e.rounds,1,100000))return false;
  if(e.role !== undefined && !['normal','elite','boss','unknown'].includes(e.role))return false;
  return ['classId','region','monster','difficulty'].every(key=>typeof e[key]==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(e[key])) && ['gold','silver','exp'].every(key=>integer(e[key],0,1000000000));
}
export function registerBalanceTelemetry(app:Express,getPool:()=>Pool,auth:RequestHandler,admin:RequestHandler) {
  registerPlayerAnalytics(app,getPool,auth,admin);
  app.post('/api/telemetry',auth,async(req,res)=>{
    const events=req.body?.events;
    if(!Array.isArray(events)||!events.length||events.length>25||!events.every(validTelemetryEvent))return res.status(400).json({error:'Некорректные метрики.'});
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      for(const e of events) {
        if(e.kind==='session') {
          const saved=await client.query(`INSERT INTO balance_sessions(telegram_id,id,sequence,level,duration_ms,net_gold,net_silver,start_level,max_level,last_screen,last_state,energy)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(telegram_id,id) DO UPDATE SET sequence=EXCLUDED.sequence,level=EXCLUDED.level,duration_ms=EXCLUDED.duration_ms,net_gold=EXCLUDED.net_gold,net_silver=EXCLUDED.net_silver,updated_at=NOW(),
          start_level=COALESCE(balance_sessions.start_level,EXCLUDED.start_level),max_level=GREATEST(balance_sessions.max_level,EXCLUDED.max_level),last_screen=COALESCE(EXCLUDED.last_screen,balance_sessions.last_screen),last_state=COALESCE(EXCLUDED.last_state,balance_sessions.last_state),energy=COALESCE(EXCLUDED.energy,balance_sessions.energy)
          WHERE balance_sessions.sequence<EXCLUDED.sequence RETURNING id`,
          [req.authUser!.id,e.id,e.sequence,e.level,e.durationMs,e.netGold,e.netSilver,e.startLevel??null,e.maxLevel??e.level,e.screen??null,e.state??null,e.energy??null]);
          if(saved.rowCount&&e.startLevel!==undefined)await client.query(`INSERT INTO balance_progress(telegram_id,session_id,level,active_ms) VALUES($1,$2,$3,$4)
           ON CONFLICT(telegram_id,session_id,level) DO UPDATE SET active_ms=LEAST(balance_progress.active_ms,EXCLUDED.active_ms)`,[req.authUser!.id,e.id,e.level,e.durationMs]);
        }
        else await client.query(`INSERT INTO balance_battles(telegram_id,id,session_id,level,class_id,region,monster,difficulty,outcome,rounds,duration_ms,gold,silver,exp,role)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(telegram_id,id) DO NOTHING`,
          [req.authUser!.id,e.id,e.sessionId,e.level,e.classId,e.region,e.monster,e.difficulty,e.outcome,e.rounds,e.durationMs,e.gold,e.silver,e.exp,e.role||'unknown']);
      }
      await client.query('INSERT INTO balance_activity(telegram_id) VALUES($1) ON CONFLICT DO NOTHING',[req.authUser!.id]);
      await client.query('COMMIT');res.json({ok:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.get('/api/admin/balance',auth,admin,async(_req,res)=>{
    const results=await Promise.all([
      getPool().query(`SELECT CASE WHEN level<25 THEN '1–24' WHEN level<55 THEN '25–54' ELSE '55+' END AS band,region,difficulty,class_id,role,COUNT(*)::int AS battles,
        ROUND(AVG(duration_ms)/1000,1) AS seconds,ROUND(AVG(rounds),1) AS rounds,ROUND(100.0*COUNT(*) FILTER(WHERE outcome='victory')/COUNT(*),1) AS win_rate,
        ROUND(AVG(exp),1) AS exp FROM balance_battles WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY band,region,difficulty,class_id,role ORDER BY band,region,difficulty,class_id,role`),
      getPool().query(`SELECT COUNT(*)::int AS sessions,ROUND(AVG(duration_ms)/60000,1) AS minutes,ROUND(AVG(net_gold),1) AS net_gold,ROUND(AVG(net_silver),1) AS net_silver FROM balance_sessions WHERE created_at>=NOW()-INTERVAL '30 days' AND duration_ms>=60000`),
      getPool().query(`WITH cohorts AS (SELECT telegram_id,MIN(day) AS day FROM balance_activity GROUP BY telegram_id),
        activity AS (SELECT telegram_id,day FROM balance_activity)
        SELECT COUNT(*) FILTER(WHERE c.day<=(NOW() AT TIME ZONE 'UTC')::date-2)::int AS eligible_d1,
          COUNT(*) FILTER(WHERE c.day<=(NOW() AT TIME ZONE 'UTC')::date-2 AND EXISTS(SELECT 1 FROM activity a WHERE a.telegram_id=c.telegram_id AND a.day=c.day+1))::int AS returned_d1,
          COUNT(*) FILTER(WHERE c.day<=(NOW() AT TIME ZONE 'UTC')::date-8)::int AS eligible_d7,
          COUNT(*) FILTER(WHERE c.day<=(NOW() AT TIME ZONE 'UTC')::date-8 AND EXISTS(SELECT 1 FROM activity a WHERE a.telegram_id=c.telegram_id AND a.day=c.day+7))::int AS returned_d7
        FROM cohorts c WHERE c.day>=(NOW() AT TIME ZONE 'UTC')::date-30`)
    ]);
    res.json({battles:results[0].rows,sessions:results[1].rows[0],retention:results[2].rows[0],source:'client_diagnostics'});
  });
}
