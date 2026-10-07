import {PGlite} from '@electric-sql/pglite';
import {Pool} from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
/** Optional real PostgreSQL path uses independent connections and isolated schemas. */
export async function progressDatabase(){
 let db:any,base:any,query:any;
 if(process.env.TEST_DATABASE_URL){
  const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});
  const schema='progress_test_'+crypto.randomBytes(8).toString('hex');
  await admin.query(`CREATE SCHEMA ${schema}`);
  base=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:6,options:`-c search_path=${schema},public`});
  query=(sql:string,args:any[]=[])=>base.query(sql,args);
  db={exec:(sql:string)=>base.query(sql),close:async()=>{await base.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}};
 }else{
  db=new PGlite();query=async(sql:string,args:any[]=[])=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
  let tail=Promise.resolve();base={query,connect:async()=>{const before=tail;let unlock!:()=>void;tail=new Promise<void>(r=>unlock=r);await before;return {query,release:unlock};}};
 }
 await db.exec((await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await db.exec(await fs.readFile('server/migrations/20261007_character_progress.sql','utf8'));
 await db.exec(await fs.readFile('server/migrations/20261007_resource_stacks.sql','utf8'));
 return {db,base,query};
}
