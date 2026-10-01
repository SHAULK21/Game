import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { CLAN_PROJECTS, clanProjectCost } from '../src/utils/clanProjects';
export function registerClanProjects(app:Express,getPool:()=>Pool,auth:RequestHandler,requireClan:RequestHandler) {
app.post('/api/clan/projects/upgrade', auth, requireClan, async (req,res) => {
  const { project, operationId } = req.body || {};
  if (!Object.hasOwn(CLAN_PROJECTS, project || '') || typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) return res.status(400).json({error:'Неверный проект или ID операции.'});
  const client=await getPool().connect();
  try {
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM clans WHERE id=$1 FOR UPDATE',[res.locals.clan.id])).rows[0];
    if (!row) throw new Error('Клан не найден.');
    const role=(await client.query('SELECT cm.role FROM clan_members cm JOIN players p ON p.telegram_id=cm.telegram_id WHERE cm.clan_id=$1 AND cm.telegram_id=$2 AND p.clan_id=cm.clan_id FOR SHARE OF cm,p',[row.id,req.authUser!.id])).rows[0]?.role;
    if (!['owner','officer'].includes(role)) throw new Error('Только глава или офицер может улучшать проекты.');
    const previous=(await client.query('SELECT * FROM clan_project_operations WHERE id=$1',[operationId])).rows[0];
    if (previous) {
      if (previous.clan_id!==row.id || Number(previous.actor)!==req.authUser!.id || previous.project!==project) throw new Error('ID операции уже использован.');
    } else {
      const level=Number(row.projects?.[project] || 0);
      if (level>=10) throw new Error('Проект достиг максимальной ступени.');
      const cost=clanProjectCost(level);
      if (Number(row.treasury_gold)<cost.gold || Number(row.treasury_silver)<cost.silver || Number(row.treasury_ore)<cost.ore) throw new Error('Недостаточно ресурсов в казне.');
      await client.query('INSERT INTO clan_project_operations(id,clan_id,actor,project) VALUES($1,$2,$3,$4)',[operationId,row.id,req.authUser!.id,project]);
      await client.query('UPDATE clans SET projects=$2::jsonb,treasury_gold=treasury_gold-$3,treasury_silver=treasury_silver-$4,treasury_ore=treasury_ore-$5 WHERE id=$1',[row.id,JSON.stringify({...row.projects,[project]:level+1}),cost.gold,cost.silver,cost.ore]);
    }
    await client.query('COMMIT');res.json({ok:true});
  } catch(error) {await client.query('ROLLBACK');res.status(400).json({error:error instanceof Error?error.message:'Ошибка проекта.'});} finally {client.release();}
});

}
