import {createContext,useContext} from 'react';
import type {ServerProgress} from '../utils/serverProgress';
export const ServerProgressContext=createContext<ServerProgress|null>(null);
export const useServerProgress=()=>useContext(ServerProgressContext);
