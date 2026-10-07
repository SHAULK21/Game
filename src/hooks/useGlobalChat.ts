import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {apiRequest} from '../utils/api';
import {triggerHaptic} from '../utils/telegram';
export type GlobalMessage={id:number|string;text:string;created_at:string;display_name:string;telegram_id?:number|string;is_premium?:boolean};
export const normalizeMessages=(value:unknown):GlobalMessage[]=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object').map((item:any,index)=>({id:item.id??`fallback_${index}`,text:String(item.text??''),created_at:String(item.created_at??new Date().toISOString()),display_name:String(item.display_name||'Игрок'),telegram_id:item.telegram_id,is_premium:Boolean(item.is_premium)})).filter(item=>item.text.length>0):[];
const numericId=(id:number|string)=>/^\d+$/.test(String(id))?BigInt(id):null;
export function mergeGlobalMessages(previous:GlobalMessage[],incoming:GlobalMessage[]):GlobalMessage[]{
 if(!incoming.length)return previous;
 const byId=new Map(previous.map(item=>[String(item.id),item]));let changed=false;
 for(const item of incoming){const old=byId.get(String(item.id));if(!old||JSON.stringify(old)!==JSON.stringify(item)){byId.set(String(item.id),item);changed=true;}}
 if(!changed)return previous;
 return [...byId.values()].sort((a,b)=>{const left=numericId(a.id),right=numericId(b.id);return left!==null&&right!==null?(left<right?-1:left>right?1:0):a.created_at.localeCompare(b.created_at);}).slice(-80);
}
export function useGlobalChat(){
 const [messages,setMessages]=useState<GlobalMessage[]>([]),[input,setInput]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState(''),[onlinePlayers,setOnlinePlayers]=useState(0);
 const inFlight=useRef(false),mounted=useRef(false),sendingRef=useRef(false),cursor=useRef(''),statsAt=useRef(-Infinity);
 const load=useCallback(async(showLoading=false)=>{
  if(inFlight.current||!mounted.current)return;inFlight.current=true;if(showLoading)setLoading(true);
  const refreshStats=showLoading||Date.now()-statsAt.current>=60000;
  // Statistics failures must not prevent message delivery.
  const stats=refreshStats?apiRequest<{onlinePlayers:number}>('/api/community/stats').then(value=>{if(mounted.current){statsAt.current=Date.now();setOnlinePlayers(Number(value.onlinePlayers||0));}}).catch(()=>undefined):Promise.resolve();
  try{
   const response=await apiRequest<{messages?:unknown}>('/api/chat/global'+(cursor.current?'?afterId='+cursor.current:''));
   if(!mounted.current)return;
   const incoming=normalizeMessages(response.messages);
   for(const message of incoming){const id=numericId(message.id);if(id!==null && (!cursor.current||id>BigInt(cursor.current)))cursor.current=String(id);}
   setMessages(previous=>mergeGlobalMessages(previous,incoming));setError('');
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Не удалось подключиться к общему чату.');}
  finally{await stats;inFlight.current=false;if(mounted.current)setLoading(false);}
 },[]);
 useEffect(()=>{
  mounted.current=true;const refresh=()=>{if(!document.hidden)void load();};refresh();
  const timer=window.setInterval(refresh,10000);document.addEventListener('visibilitychange',refresh);
  return()=>{mounted.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[load]);
 const send=async(event:React.FormEvent)=>{
  event.preventDefault();const text=input.trim();if(!text||sendingRef.current)return;sendingRef.current=true;setSending(true);
  try{
   const response=await apiRequest<{message?:unknown}>('/api/chat/global',{method:'POST',body:JSON.stringify({text})});
   if(!mounted.current)return;
   setMessages(previous=>mergeGlobalMessages(previous,normalizeMessages(response.message?[response.message]:[])));
   // Only polling advances the cursor: advancing to our own message could skip others.
   setInput('');setError('');triggerHaptic('light');
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Не удалось отправить сообщение.');triggerHaptic('error');}}
  finally{sendingRef.current=false;if(mounted.current)setSending(false);}
 };
 const renderedMessages=useMemo(()=>messages,[messages]);
 return {input,setInput,loading,sending,error,onlinePlayers,load,send,renderedMessages};
}
