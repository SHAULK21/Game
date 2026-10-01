import { petBattleOpening } from '../src/utils/petCombat';
import type { Monster, Pet } from '../src/types/game';
import { combatHitChance, incomingAttackRoll } from '../src/utils/combatBonuses';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { applyDungeonDifficulty } from '../src/utils/dungeonRewards';
import { sharpeningQuote, sharpeningMultiplier } from '../src/utils/sharpening';

import { getStatusModifiers, tickStatusEffects } from '../src/utils/statusEffects';
import { clanRaidHealth, clanRaidReward } from '../src/utils/clanProjects';
import { validTelemetryEvent, registerBalanceTelemetry } from '../server/balanceTelemetry';
import { registerClanProjects } from '../server/clanProjects';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';

const dataBundle=await build({stdin:{contents:"export {MONSTERS,REGIONS,REGIONAL_TROPHIES} from './src/data/gameData';export {smithingQuality,smithingProgress} from './src/utils/professions';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
const {MONSTERS,REGIONS,REGIONAL_TROPHIES,smithingQuality,smithingProgress}=await import('data:text/javascript;base64,'+Buffer.from(dataBundle.outputFiles[0].text).toString('base64')) as typeof import('../src/data/gameData') & typeof import('../src/utils/professions');

test('harder dungeons increase actual enemies; each veteran region has regular trophy sources',()=>{
 const base=MONSTERS.m_wolf;let hp=0,attack=0;
 for(const mode of ['normal','hard','nightmare','hell'] as const){const enemy=applyDungeonDifficulty(base,mode);assert.ok(enemy.maxHp>hp && enemy.attack>attack);hp=enemy.maxHp;attack=enemy.attack;}
 assert.equal(base.maxHp,MONSTERS.m_wolf.maxHp);
 for(const region of REGIONS.filter(r=>r.minLevel>=40)){
  const ordinary=region.monsters.map(id=>MONSTERS[id]).filter(m=>!m.isBoss);
  assert.ok(ordinary.length>=2,region.id);
  for(const monster of ordinary){assert.equal(monster.regionId,region.id);assert.ok(REGIONAL_TROPHIES[region.id][monster.id]);}
 }
});
test('forge checkpoints, costs and mastery have bounded long-term progression',()=>{
 for(let level=0;level<5;level++)assert.equal(sharpeningQuote(level,false,true).chance,1);
 for(const level of [5,10,15,20])assert.equal(sharpeningQuote(level,false).failureLevel,level);
 assert.equal(sharpeningQuote(12,false).failureLevel,11);assert.equal(sharpeningQuote(12,true).failureLevel,12);
 assert.equal(sharpeningMultiplier(25),2.5);assert.equal(sharpeningMultiplier(1000),2.5);
 assert.ok(sharpeningQuote(24,false).gold<70000);
 assert.equal(smithingProgress(24750).level,100);assert.equal(smithingProgress(999999).level,100);
 assert.equal(smithingQuality(0,.45).rarity,'common');assert.equal(smithingQuality(24750,.45).rarity,'uncommon');
 assert.equal(clanRaidHealth(15),38000);assert.ok(clanRaidReward(15,10).xp>clanRaidReward(1,0).xp);
});
test('accuracy, evasion and enemy critical chance participate in direct attack rolls',()=>{
 assert.equal(combatHitChance(90,5),85);assert.equal(combatHitChance(100,25),75);
 assert.equal(incomingAttackRoll(100,50,0,()=>0.8).damage,0);
 assert.equal(incomingAttackRoll(100,0,75,()=>0.5).damage,150);
 assert.equal(incomingAttackRoll(100,0,0,()=>0.5).damage,100);
});
test('golem opening fortify protects two enemy turns after player action ticks',()=>{
 let effects=petBattleOpening({maxHp:100} as Monster,{id:'pet_golem'} as Pet).playerEffects;
 effects=tickStatusEffects(effects).effects;
 assert.equal(getStatusModifiers(effects).damageTakenMultiplier,0.85);
 effects=tickStatusEffects(effects).effects;
 assert.equal(getStatusModifiers(effects).damageTakenMultiplier,0.85);
 effects=tickStatusEffects(effects).effects;
 assert.equal(getStatusModifiers(effects).damageTakenMultiplier,1);
});
test('temporary critical chance buffs expire without permanent crit inflation',()=>{
 const effects=[{type:'focus' as const,name:'Зелье',duration:1,value:15}];
 assert.equal(getStatusModifiers(effects).critBonus,15);
 assert.equal(getStatusModifiers(tickStatusEffects(effects).effects).critBonus,0);
});
test('Postgres telemetry retries preserve latest snapshots; admin access and clan project spending are enforced',async()=>{
 const db=new PGlite(),oldAdmin=process.env.ADMIN_TELEGRAM_ID;
 const query=async(sql:string,args:any[]=[])=>{const r=await db.query<any>(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};};
 const client={query,release(){}},pool:any={query,connect:async()=>client};
 const routes=new Map<string,any[]>();const app:any={get:(p:string,...h:any[])=>routes.set('GET '+p,h),post:(p:string,...h:any[])=>routes.set('POST '+p,h)};
 const auth:any=(_req:any,_res:any,next:any)=>next();
 const admin:any=(req:any,res:any,next:any)=>req.authUser.id===1?next():res.status(403).json({error:'admin'});
 registerBalanceTelemetry(app,()=>pool,auth,admin);
 const clan='00000000-0000-4000-8000-000000000011';
 registerClanProjects(app,()=>pool,auth,(_req:any,res:any,next:any)=>{res.locals.clan={id:clan};next();});
 const call=async(method:string,path:string,user:number,body:any={})=>{
  let status=200,result:any;const req:any={authUser:{id:user},body};const res:any={locals:{},status:(s:number)=>{status=s;return res;},json:(r:any)=>{result=r;return res;}};
  for(const h of routes.get(method+' '+path)!){let next=false;await h(req,res,()=>{next=true;});if(!next)break;}return {status,body:result};
 };
 try{
  const schema=(await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','');
  await db.exec(schema);await db.exec(schema);
  await query("INSERT INTO players(telegram_id,display_name) VALUES(1,'A'),(2,'B')");
  const session={kind:'session',id:'00000000-0000-4000-8000-000000000012',sequence:2,level:20,durationMs:120000,netGold:-50,netSilver:10};
  const battle={kind:'battle',id:'00000000-0000-4000-8000-000000000013',sessionId:session.id,level:20,classId:'mage',region:'reg_forest',monster:'m_spider',difficulty:'hard',outcome:'victory',rounds:4,durationMs:8000,gold:10,silver:5,exp:30};
  assert.equal(validTelemetryEvent({...battle,durationMs:-1}),false);assert.equal(validTelemetryEvent({...session,netGold:NaN}),false);
  assert.equal((await call('POST','/api/telemetry',1,{events:[session,battle]})).status,200);
  assert.equal((await call('POST','/api/telemetry',1,{events:[{...session,sequence:1,netGold:999},battle]})).status,200);
  assert.equal((await query('SELECT net_gold FROM balance_sessions')).rows[0].net_gold,-50);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM balance_battles')).rows[0].n,1);
  assert.equal((await call('GET','/api/admin/balance',2)).status,403);
  await query("INSERT INTO balance_activity(telegram_id,day) VALUES(2,(NOW() AT TIME ZONE 'UTC')::date-10),(2,(NOW() AT TIME ZONE 'UTC')::date-9),(2,(NOW() AT TIME ZONE 'UTC')::date-3)");
  const report=await call('GET','/api/admin/balance',1);assert.equal(report.status,200);assert.equal(report.body.sessions.sessions,1);assert.equal(Number(report.body.battles[0].seconds),8);assert.equal(report.body.retention.eligible_d1,1);assert.equal(report.body.retention.returned_d1,1);assert.equal(report.body.retention.returned_d7,1);
  await query("INSERT INTO clans(id,tag,name,owner_telegram_id,treasury_gold,treasury_silver,treasury_ore) VALUES($1,'TEST','Test',1,500,200,20)",[clan]);
  await query('UPDATE players SET clan_id=$1',[clan]);
  await query("INSERT INTO clan_members(clan_id,telegram_id,role) VALUES($1,1,'owner'),($1,2,'member')",[clan]);
  const operation={project:'arsenal',operationId:'00000000-0000-4000-8000-000000000014'};
  assert.equal((await call('POST','/api/clan/projects/upgrade',2,operation)).status,400);
  assert.equal((await call('POST','/api/clan/projects/upgrade',1,operation)).status,200);
  assert.equal((await call('POST','/api/clan/projects/upgrade',1,operation)).status,200);
  const state=(await query('SELECT projects,treasury_gold FROM clans WHERE id=$1',[clan])).rows[0];assert.equal(state.projects.arsenal,1);assert.equal(state.treasury_gold,250);
  assert.equal((await call('POST','/api/clan/projects/upgrade',1,{...operation,project:'research'})).status,400);
  assert.equal((await call('POST','/api/clan/projects/upgrade',1,{...operation,operationId:'00000000-0000-4000-8000-000000000015'})).status,400);
  assert.equal((await query('SELECT treasury_gold FROM clans WHERE id=$1',[clan])).rows[0].treasury_gold,250);
 }finally{process.env.ADMIN_TELEGRAM_ID=oldAdmin;await db.close();}
});
