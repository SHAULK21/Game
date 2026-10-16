import {AsyncLocalStorage} from 'node:async_hooks';
import crypto from 'node:crypto';
import type {Pool,PoolClient} from 'pg';

const transactions=new AsyncLocalStorage<PoolClient>();
/** Existing route transactions become savepoints inside the character transaction. */
export function gameTransactionPool(pool:Pool):Pool {
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

export function withGameTransaction<T>(client:PoolClient,fn:()=>Promise<T>):Promise<T>{return transactions.run(client,fn);}
