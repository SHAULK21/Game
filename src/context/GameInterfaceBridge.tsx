import {useLayoutEffect, useMemo} from 'react';
import {useGame} from './GameContext';
import {useInterface} from './InterfaceContext';
import {useGameOperation} from '../utils/gameOperations';
/** Connects persistence/action guards without coupling presentation to game state. */
export function GameInterfaceBridge() {
  const {getInterfaceSwitchBlockReason,flushProgress,commitSwitchSnapshot} = useGame();
  const {registerSwitchPolicy,setBlockReason} = useInterface();
  const operation = useGameOperation();
  const policy = useMemo(() => ({commit:commitSwitchSnapshot,getBlockReason:getInterfaceSwitchBlockReason,save:flushProgress}),[getInterfaceSwitchBlockReason,flushProgress,commitSwitchSnapshot]);
  useLayoutEffect(() => registerSwitchPolicy(policy),[registerSwitchPolicy,policy]);
  useLayoutEffect(() => { setBlockReason(policy.getBlockReason()); },[policy,operation,setBlockReason]);
  return null;
}
