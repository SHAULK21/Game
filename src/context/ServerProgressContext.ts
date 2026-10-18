import {createContext,useContext,useSyncExternalStore} from 'react';
import type {ServerProgress} from '../utils/serverProgress';
export const ServerProgressContext=createContext<ServerProgress|null>(null);
const idleSubscribe=()=>()=>{};
const idleSnapshot=()=>0;
export function useServerProgress(){
 const client=useContext(ServerProgressContext);
 // Session-aware controls subscribe directly; gameplay-only consumers stay stable
 // while transport status changes without a new confirmed game projection.
 useSyncExternalStore(client?.subscribe??idleSubscribe,client?.getSnapshot??idleSnapshot,idleSnapshot);
 return client;
}
