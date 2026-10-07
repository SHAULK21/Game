import React, {useEffect} from 'react';
import {observeMobileViewport} from './utils/mobileViewport';
import {initTelegramApp} from './utils/telegram';
import {useLocale} from './i18n/locale';
import {InterfaceProvider} from './context/InterfaceContext';
import {AccountSessionGate} from './components/layout/AccountSessionGate';
import {GameProvider} from './context/GameContext';
import {NavigationProvider} from './context/NavigationContext';
import {GameInterfaceBridge} from './context/GameInterfaceBridge';
import {InterfaceLoader} from './interfaces/InterfaceLoader';
export default function App() {
  useLocale();
  useEffect(() => { initTelegramApp(); return observeMobileViewport(); }, []);
  return <InterfaceProvider><AccountSessionGate><GameProvider><NavigationProvider><GameInterfaceBridge/><InterfaceLoader/></NavigationProvider></GameProvider></AccountSessionGate></InterfaceProvider>;
}
