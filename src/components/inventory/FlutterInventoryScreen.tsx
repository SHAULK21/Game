import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useGame} from '../../context/GameStateContext';
import {useInterface} from '../../context/InterfaceContext';
import {t,useLocale} from '../../i18n/locale';
import {loadFlutterInventory} from '../../utils/flutterInventoryLoader';
import {inventoryAction,inventoryProjection} from './flutterInventoryBridge';
const ClassicModern=lazy(()=>import('./InventoryScreen').then(m=>({default:m.InventoryScreen})));
const ClassicFantasy=lazy(()=>import('../../interfaces/fantasy/components/inventory/InventoryScreen').then(m=>({default:m.InventoryScreen})));
type Props={onNavigateToBlacksmith?:()=>void;onNavigateToCrafting?:()=>void};

export function FlutterInventoryScreen(props:Props) {
 const game=useGame(),{locale}=useLocale(),{style}=useInterface();
 const host=useRef<HTMLDivElement>(null),latest=useRef({game,props}),busy=useRef(false);
 latest.current={game,props};
 const [status,setStatus]=useState<'loading'|'ready'|'failed'>('loading'),[classic,setClassic]=useState(false);
 const projection=useMemo(()=>inventoryProjection(game,t,locale),[game.player,game.premium.active,game.isInCombat,game.travelState,locale]);
 const snapshot=useRef(projection);snapshot.current=projection;
 useEffect(()=>{if(!classic&&status==='ready'&&projection)window.aethelgardInventoryUpdate?.(JSON.stringify(projection));},[projection,status,classic]);
 useEffect(()=>{
  if(classic||!game.player)return;
  let disposed=false,remove:(()=>void)|undefined;
  const owner=game.player.userId;
  const action=async(json:string)=>{
   if(disposed||busy.current)return JSON.stringify({success:false,message:t('Дождитесь завершения операции.')});
   busy.current=true;
   try {
    if(json.length>100000)throw Error('Некорректный запрос.');
    const input=JSON.parse(json),current=latest.current;
    if(input.owner!==owner)throw Error('Персонаж изменился. Откройте сумку заново.');
    const result=await inventoryAction(current.game,input,screen=>screen==='blacksmith'?current.props.onNavigateToBlacksmith?.():current.props.onNavigateToCrafting?.());
    return JSON.stringify({...result,message:t('message' in result?result.message:'')});
   } catch(error){return JSON.stringify({success:false,message:t(error instanceof Error?error.message:'Не удалось выполнить действие.')});}
   finally {busy.current=false;}
  };
  window.aethelgardInventoryAction=action;
  loadFlutterInventory().then(app=>{
   if(disposed||!host.current)return;
   const id=app.addView({hostElement:host.current});remove=()=>{app.removeView(id);};
   window.aethelgardInventoryUpdate?.(JSON.stringify(snapshot.current));setStatus('ready');
  }).catch(()=>{if(!disposed)setStatus('failed');});
  return()=>{disposed=true;remove?.();if(window.aethelgardInventoryAction===action)delete window.aethelgardInventoryAction;};
 },[game.player?.userId,classic]);
 if(!game.player)return null;
 if(classic||status==='failed') {
  const Fallback=style==='modern'?ClassicModern:ClassicFantasy;
  return <><div className="px-3 pt-3 text-xs text-slate-400">{status==='failed'?t('Инвентарь не загрузился. Открыта обычная версия.'):t('Обычная версия инвентаря')}</div><Suspense fallback={<div role="status" className="p-6">{t('Загрузка интерфейса…')}</div>}><Fallback {...props}/></Suspense></>;
 }
 return <section className="flutter-inventory-screen" data-flutter-inventory={status}>
  <div className="flex items-center justify-end px-3 py-1"><button type="button" className="min-h-9 px-2 text-xs text-slate-400 underline" onClick={()=>setClassic(true)}>{t('Обычный инвентарь')}</button></div>
  {status==='loading'&&<div role="status" className="p-6 text-center text-sm text-slate-300">{t('Подготовка инвентаря…')}</div>}
  <div ref={host} aria-label={t('Сумка')} style={{height:'calc(100dvh - 190px)',minHeight:400,maxHeight:960,width:'100%',position:'relative',overflow:'hidden',visibility:status==='ready'?'visible':'hidden'}}/>
 </section>;
}
