import {createContext,useContext} from 'react';
import type {RuntimeGameContext} from './GameContext';
export type {GameContextType,RuntimeGameContext} from './GameContext';

// UI subscriptions must not import the local simulation or its data catalogs.
// Both providers share this exact context; engine types disappear at build time.
export const GameContext=createContext<RuntimeGameContext|undefined>(undefined);
export function useGame(){
 const context=useContext(GameContext);
 if(!context)throw new Error('useGame must be used within a GameProvider');
 return context;
}
