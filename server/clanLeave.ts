export async function leavePlayerClan(pool:any,userId:number,clanId:string,confirmDisband:boolean) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const clan=(await client.query('SELECT id FROM clans WHERE id=$1 FOR UPDATE',[clanId])).rows[0];
  if(!clan)throw new Error('Клан не найден.');
  const member=(await client.query('SELECT role FROM clan_members WHERE clan_id=$1 AND telegram_id=$2 FOR UPDATE',[clanId,userId])).rows[0];
  if(!member)throw new Error('Вы уже вышли из клана.');
  let disbanded=false;
  if(member.role==='owner') {
   const next=(await client.query(`SELECT telegram_id FROM clan_members WHERE clan_id=$1 AND telegram_id<>$2 ORDER BY CASE role WHEN 'officer' THEN 0 WHEN 'quartermaster' THEN 1 WHEN 'veteran' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,joined_at,telegram_id LIMIT 1 FOR UPDATE`,[clanId,userId])).rows[0];
   if(next) {
    await client.query("UPDATE clan_members SET role='owner' WHERE clan_id=$1 AND telegram_id=$2",[clanId,next.telegram_id]);
    await client.query('UPDATE clans SET owner_telegram_id=$1,updated_at=NOW() WHERE id=$2',[next.telegram_id,clanId]);
   } else {
    if(!confirmDisband)throw new Error('Вы последний участник. Подтвердите роспуск клана: казна и клановый склад будут удалены.');
    disbanded=true;
   }
  }
  await client.query('DELETE FROM clan_members WHERE clan_id=$1 AND telegram_id=$2',[clanId,userId]);
  await client.query('UPDATE players SET clan_id=NULL,updated_at=NOW() WHERE telegram_id=$1',[userId]);
  if(disbanded)await client.query('DELETE FROM clans WHERE id=$1',[clanId]);
  await client.query('COMMIT');return {ok:true,disbanded};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
