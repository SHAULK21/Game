import test from 'node:test';
import assert from 'node:assert/strict';
import {startProgressPolling, progressPollDelay} from '../src/utils/progressPolling';
import {ServerProgress} from '../src/utils/serverProgress';
const flush = async () => {for (let i=0;i<12;i++) await Promise.resolve();};
function fixture() {
  let now=1000, nextId=0, visible=true, loads=0, recoveries=0;
  const timers=new Map<number,{at:number;callback:()=>void}>(), listeners=new Set<()=>void>();
  const client={current:{serverTime:now,activeHere:true,writerPresent:true,nextTickAt:null as number|null},receivedAt:now,roundTripMs:0,requestInFlight:false,pending:null as unknown,status:'saved',
    subscribe(callback:()=>void){listeners.add(callback);return()=>{listeners.delete(callback);};},
    async load(){loads++;client.receivedAt=now;client.current.serverTime=now;client.current.nextTickAt=null;emit();},
    async acquire(){},async resolveConflict(){recoveries++;}};
  const emit=()=>listeners.forEach(callback=>callback());
  const polling=startProgressPolling(client,{now:()=>now,visible:()=>visible,
    setTimeout(callback,delay){const id=++nextId;timers.set(id,{at:now+delay,callback});return id;},clearTimeout(id){timers.delete(id as number);}});
  const advance=async(ms:number)=>{const end=now+ms;while(true){const due=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!due||due[1].at>end)break;now=due[1].at;timers.delete(due[0]);due[1].callback();await flush();}now=end;await flush();};
  return {client,emit,polling,timers,advance,loads:()=>loads,recoveries:()=>recoveries,hide:()=>{visible=false;polling.wake();},show:()=>{visible=true;polling.wake();}};
}
test('enabling autobattle replaces an already armed idle poll with its combat deadline',async()=>{
  const f=fixture();await flush();assert.equal(f.loads(),1);
  assert.equal([...f.timers.values()][0].at,16000);
  f.client.current.nextTickAt=1600;f.emit();
  await f.advance(624);assert.equal(f.loads(),1);
  await f.advance(1);assert.equal(f.loads(),2);f.polling.stop();
});
test('polling waits for a mutation to finish, resumes on its completion and pauses when hidden',async()=>{
  const f=fixture();await flush();f.client.requestInFlight=true;f.client.pending={operationId:'same'};f.emit();
  await f.advance(20000);assert.equal(f.loads(),1);assert.equal(f.recoveries(),0);
  f.client.requestInFlight=false;f.client.pending=null;f.client.receivedAt=21000;f.client.current.serverTime=21000;f.client.current.nextTickAt=21600;f.emit();
  await f.advance(625);assert.equal(f.loads(),2);
  f.hide();await f.advance(20000);assert.equal(f.loads(),2);
  f.show();await f.advance(0);assert.equal(f.loads(),3);
  f.polling.stop();assert.equal(f.timers.size,0);
});
test('combat polling accounts for response latency and backs off connection failures',()=>{
  const client={current:{activeHere:true,serverTime:1000,nextTickAt:1600},receivedAt:1200,roundTripMs:200,status:'saved'};
  assert.equal(progressPollDelay(client,1200),425);
  assert.equal(progressPollDelay(client,1600),50);
  assert.equal(progressPollDelay({...client,status:'offline'},1600),1000);
});
test('concurrent reads coalesce and a clicked command waits for the confirmed version',async()=>{
  let release!:(value:any)=>void;let gets=0,posts=0;
  const envelope=(version:number)=>({protocol:'server-actions-v1',ownerId:'9601',resetVersion:0,version,sessionGeneration:1,activeHere:true,writerPresent:true,serverTime:1000,nextTickAt:null});
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const client=new ServerProgress('9601',crypto.randomUUID(),storage,async(_path,init)=>{
    if(!init.method){gets++;return new Promise(resolve=>{release=resolve;});}
    posts++;const headers=new Headers(init.headers);assert.equal(headers.get('x-game-version'),'7');
    return {...envelope(8),operation:{id:headers.get('x-game-operation'),outcome:'applied',result:{success:true}}};
  });
  const events:boolean[]=[];client.subscribe(()=>events.push(client.requestInFlight));
  const first=client.load(),second=client.load(),command=client.mutate('/api/progress/command',{type:'toggleAutoBattle'});
  assert.equal(gets,1);assert.equal(posts,0);release(envelope(7));
  await Promise.all([first,second,command]);assert.equal(posts,1);assert.equal(client.current?.version,8);
  assert.equal(client.pending,null);assert.equal(events.at(-1),false);
});
