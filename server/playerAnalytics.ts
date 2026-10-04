import type {Express,RequestHandler} from 'express';
import type {Pool} from 'pg';

/** One row per observed player. Window selects first observed session, not each heartbeat. */
const cohort=`WITH totals AS (
 SELECT telegram_id,MIN(created_at) AS first_seen,MAX(updated_at) AS last_seen,COUNT(*)::int AS sessions,
 MAX(COALESCE(max_level,level)) AS reached_level,SUM(duration_ms) AS active_ms FROM balance_sessions WHERE telegram_id<>$2 GROUP BY telegram_id
), first_session AS (SELECT DISTINCT ON(telegram_id) telegram_id,start_level,duration_ms FROM balance_sessions ORDER BY telegram_id,created_at,id),
 last_session AS (SELECT DISTINCT ON(telegram_id) * FROM balance_sessions ORDER BY telegram_id,updated_at DESC,created_at DESC,id),
 people AS (SELECT t.*,f.start_level,f.duration_ms AS first_ms,l.level AS last_level,l.last_screen,l.last_state,l.energy,
 l.id AS last_session_id FROM totals t JOIN first_session f USING(telegram_id) JOIN last_session l USING(telegram_id)
 WHERE t.first_seen>=NOW()-$1*INTERVAL '1 day')`;

export function registerPlayerAnalytics(app:Express,getPool:()=>Pool,auth:RequestHandler,admin:RequestHandler){
 app.get('/api/admin/player-analytics',auth,admin,async(req,res)=>{
  const days=Number(req.query?.days||30);
  if(![7,30,90].includes(days))return res.status(400).json({error:'Период: 7, 30 или 90 дней.'});
  const queries=[
   `${cohort} SELECT COUNT(*)::int AS players,COUNT(*) FILTER(WHERE start_level=1)::int AS newcomers,
    COUNT(*) FILTER(WHERE sessions>1)::int AS returned,
    COUNT(*) FILTER(WHERE last_seen<NOW()-INTERVAL '24 hours')::int AS inactive_24h,
    COUNT(*) FILTER(WHERE start_level=1 AND reached_level<=3 AND last_seen<NOW()-INTERVAL '24 hours')::int AS stopped_early,
    ROUND(AVG(first_ms)/60000,1) AS first_minutes,ROUND(AVG(active_ms)/60000,1) AS total_minutes,
    MIN(first_seen) AS collecting_since FROM people`,
   `${cohort} SELECT n.level,COUNT(p.telegram_id)::int AS eligible,
    COUNT(p.telegram_id) FILTER(WHERE p.reached_level>=n.level)::int AS reached,
    COUNT(p.telegram_id) FILTER(WHERE p.last_level=n.level AND p.last_seen<NOW()-INTERVAL '24 hours')::int AS inactive_here
    FROM generate_series(1,10) n(level) LEFT JOIN people p ON p.start_level=1 GROUP BY n.level ORDER BY n.level`,
   `${cohort}, checkpoints AS (
    SELECT b.telegram_id,b.level,MIN(s.created_at) AS session_start
    FROM balance_progress b JOIN balance_sessions s ON s.telegram_id=b.telegram_id AND s.id=b.session_id
    JOIN people p ON p.telegram_id=b.telegram_id WHERE p.start_level=1 GROUP BY b.telegram_id,b.level
   ), times AS (
    SELECT c.telegram_id,c.level,MIN(b.active_ms) + COALESCE((SELECT SUM(s.duration_ms) FROM balance_sessions s WHERE s.telegram_id=c.telegram_id AND s.created_at<c.session_start),0) AS active_ms
    FROM checkpoints c JOIN balance_progress b ON b.telegram_id=c.telegram_id AND b.level=c.level
    JOIN balance_sessions bs ON bs.telegram_id=b.telegram_id AND bs.id=b.session_id AND bs.created_at=c.session_start
    GROUP BY c.telegram_id,c.level,c.session_start
   ) SELECT level,COUNT(*)::int AS samples,ROUND(AVG(active_ms)/60000,1) AS minutes FROM times WHERE level<=10 GROUP BY level ORDER BY level`,
   `${cohort} SELECT b.level,COUNT(*)::int AS battles,COUNT(*) FILTER(WHERE outcome='defeat')::int AS defeats,
    COUNT(*) FILTER(WHERE outcome='flee')::int AS flees,ROUND(AVG(duration_ms)/1000,1) AS seconds,
    ROUND(AVG(rounds),1) AS rounds,ROUND(AVG(exp),1) AS exp FROM balance_battles b JOIN people p USING(telegram_id)
    WHERE b.level<=10 GROUP BY b.level ORDER BY b.level`,
   `${cohort} SELECT p.*,COALESCE(pl.character_name,pl.display_name) AS name,pl.class_id,
    b.outcome AS last_outcome,b.monster AS last_monster,b.region AS last_region,b.duration_ms AS last_battle_ms
    FROM people p JOIN players pl USING(telegram_id)
    LEFT JOIN LATERAL(SELECT outcome,monster,region,duration_ms FROM balance_battles WHERE telegram_id=p.telegram_id AND session_id=p.last_session_id ORDER BY created_at DESC,id DESC LIMIT 1)b ON TRUE
    ORDER BY p.last_seen DESC,p.telegram_id LIMIT 50`,
   `${cohort} SELECT class_id,COUNT(*)::int AS players,COUNT(*) FILTER(WHERE p.reached_level>=4)::int AS level4,
    COUNT(*) FILTER(WHERE p.last_seen<NOW()-INTERVAL '24 hours' AND p.reached_level<=3)::int AS inactive_early
    FROM people p JOIN players pl USING(telegram_id) WHERE p.start_level=1 GROUP BY class_id ORDER BY players DESC,class_id`
  ];
  const results=await Promise.all(queries.map(sql=>getPool().query(sql,[days,req.authUser!.id])));
  res.json({days,summary:results[0].rows[0],funnel:results[1].rows,milestones:results[2].rows,battles:results[3].rows,players:results[4].rows,classes:results[5].rows,source:'client_diagnostics'});
 });
}
