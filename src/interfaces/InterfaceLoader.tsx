import React,{lazy,Suspense} from 'react';
import {useInterface,type InterfaceStyle} from '../context/InterfaceContext';
import {t,useLocale} from '../i18n/locale';
import {StartupReady} from '../components/layout/StartupReady';
const interfaces = {
  modern: lazy(() => import('./modern/entry')),
  fantasy: lazy(() => import('./fantasy/entry')),
  'fantasy-beta': lazy(() => import('./fantasy-beta/entry')),
};
function LoadingScreen() {
  useLocale();
  return <div className="interface-loading" role="status"><StartupReady/><span className="interface-spinner" aria-hidden="true"/><p>{t('Загрузка интерфейса…')}</p></div>;
}
class InterfaceLoadBoundary extends React.Component<React.PropsWithChildren<{style:InterfaceStyle}>,{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error:Error) { console.error('Interface load failed:',this.props.style,error); }
  render() {
    return this.state.failed ? <InterfaceLoadError/> : this.props.children;
  }
}
function InterfaceLoadError() {
  useLocale();
  return <div className="interface-loading" role="alert"><StartupReady/><p>{t('Не удалось загрузить интерфейс. Проверьте соединение и повторите попытку.')}</p><button onClick={() => window.location.reload()}>{t('Повторить загрузку')}</button></div>;
}
export function InterfaceLoader() {
  const {style} = useInterface();
  const Content = interfaces[style];
  return <InterfaceLoadBoundary key={style} style={style}><Suspense fallback={<LoadingScreen/>}><Content/></Suspense></InterfaceLoadBoundary>;
}
