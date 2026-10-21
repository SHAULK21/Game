import {CharacterGate} from './components/layout/CharacterGate';
import {ServerGameProvider} from './context/ServerGameProvider';
import {getTelegramWebApp} from './utils/telegram';
import React, {lazy,Suspense,useEffect} from 'react';
import {observeMobileViewport} from './utils/mobileViewport';
import {initTelegramApp} from './utils/telegram';
import {useLocale} from './i18n/locale';
import {InterfaceProvider} from './context/InterfaceContext';
import {AccountSessionGate} from './components/layout/AccountSessionGate';
import {NavigationProvider} from './context/NavigationContext';
import {GameInterfaceBridge} from './context/GameInterfaceBridge';
import {InterfaceLoader} from './interfaces/InterfaceLoader';
const LocalGameProvider=lazy(()=>import('./context/GameContext').then(module=>({default:module.GameProvider})));
export default function App() {
  useLocale();
  useEffect(() => { initTelegramApp(); return observeMobileViewport(); }, []);
  const Provider=getTelegramWebApp()?.initData?ServerGameProvider:LocalGameProvider;
  return <CharacterGate><InterfaceProvider><AccountSessionGate><Suspense fallback={<div className="interface-loading" role="status">…</div>}><Provider><NavigationProvider><GameInterfaceBridge/><InterfaceLoader/></NavigationProvider></Provider></Suspense></AccountSessionGate></InterfaceProvider></CharacterGate>;
}
