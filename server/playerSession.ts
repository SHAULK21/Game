import type {Pool} from 'pg';
export type SessionIdentity = {id:number; username?:string; displayName:string};
/** Reads do not write presence or ranking timestamps. Metadata changes are rare. */
export async function authenticatePlayer(pool: Pick<Pool,'query'>, identity:SessionIdentity) {
 const args=[identity.id,identity.username || null,identity.displayName];
 let row=(await pool.query('SELECT reset_version,username,display_name FROM players WHERE telegram_id=$1',[identity.id])).rows[0];
 if(!row){
  await pool.query('INSERT INTO players(telegram_id,username,display_name) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO NOTHING',args);
  row=(await pool.query('SELECT reset_version,username,display_name FROM players WHERE telegram_id=$1',[identity.id])).rows[0];
 }
 if(row.username !== args[1] || row.display_name !== identity.displayName){
  row=(await pool.query('UPDATE players SET username=$2,display_name=$3 WHERE telegram_id=$1 RETURNING reset_version',args)).rows[0];
 }
 return Number(row.reset_version);
}
export async function heartbeatPlayer(pool: Pick<Pool,'query'>, userId:number) {
 await pool.query("UPDATE players SET last_seen_at=NOW() WHERE telegram_id=$1 AND (last_seen_at IS NULL OR last_seen_at < NOW()-INTERVAL '60 seconds')",[userId]);
}
export function communityStatsCache(pool:()=>Pick<Pool,'query'>, now=Date.now) {
 type Stats={totalPlayers:number;onlinePlayers:number;onlineWindowMinutes:number};
 let cached:Stats|null=null;
 let until=0;let inFlight:Promise<Stats>|null=null;
 return async()=>{
  if(cached && now()<until)return cached;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   const result=await pool().query("SELECT COUNT(*)::int AS total_players, COUNT(*) FILTER(WHERE last_seen_at >= NOW()-INTERVAL '5 minutes')::int AS online_players FROM players");
   cached={totalPlayers:Number(result.rows[0]?.total_players||0),onlinePlayers:Number(result.rows[0]?.online_players||0),onlineWindowMinutes:5};until=now()+15000;return cached;
  })();
  try{return await inFlight;}finally{inFlight=null;}
 };
}
