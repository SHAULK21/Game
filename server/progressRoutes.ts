import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ProgressStore } from './progressStore';
import { ProgressError } from './progressValidation';
export function registerProgress(app: Express, getPool:()=>Pool, auth:RequestHandler) {
  const route=(action:(store:ProgressStore,req:any)=>Promise<any>):RequestHandler=>async(req,res)=>{
    try { res.json(await action(new ProgressStore(getPool()),req)); }
    catch(error) {
      if (!(error instanceof ProgressError)) throw error;
      const latest=await new ProgressStore(getPool()).load(req.authUser!.id,String(req.get('X-Game-Session')||''));
      res.status(error.status).json({code:error.code,error:error.message,latest,resetVersion:latest.resetVersion});
    }
  };
  app.get('/api/progress',auth,route((s,r)=>s.load(r.authUser.id,String(r.get('X-Game-Session')||''))));
  app.get('/api/progress/operations/:operationId',auth,async(req,res)=>{
    const found=await getPool().query('SELECT operation_id FROM progress_api_operations WHERE telegram_id=$1 AND operation_id=$2',[req.authUser!.id,req.params.operationId]);
    const latest=await new ProgressStore(getPool()).load(req.authUser!.id,String(req.get('X-Game-Session')||''));
    res.json({completed:Boolean(found.rows[0]),latest});
  });
  app.post('/api/progress/session',auth,route((s,r)=>s.acquire(r.authUser.id,String(r.get('X-Game-Session')||''),r.body?.expectedGeneration,r.body?.transfer===true)));
  app.post('/api/progress/migrate',auth,route((s,r)=>s.write(r.authUser.id,String(r.get('X-Game-Session')||''),r.body,'migrate')));
  app.post('/api/progress/create',auth,route((s,r)=>s.write(r.authUser.id,String(r.get('X-Game-Session')||''),r.body,'create')));
  app.post('/api/progress/checkpoint',auth,route((s,r)=>s.write(r.authUser.id,String(r.get('X-Game-Session')||''),r.body,'checkpoint')));
}
