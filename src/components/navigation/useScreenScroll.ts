import {getTelegramUser} from '../../utils/telegram';
import {readResetVersion} from '../../utils/accountReset';
import {useLayoutEffect} from 'react';
/** Device/account UI context only. Never restores a game action. */
export function useScreenScroll(key:string,screen:string){
 useLayoutEffect(()=>{
  if(screen==='world')return;
  const storageKey=`${key}_scroll_${screen}`;
  const scroller=document.querySelector<HTMLElement>('.shell-main');
  const position=()=>scroller&&scroller.scrollHeight>scroller.clientHeight?scroller.scrollTop:window.scrollY;
  const save=()=>{try{sessionStorage.setItem(storageKey,String(position()));}catch{}};
  let saved=0;try{saved=Number(sessionStorage.getItem(storageKey)||0);}catch{}
  let restoring=true;
  const timer=window.setTimeout(()=>{if(scroller&&scroller.scrollHeight>scroller.clientHeight)scroller.scrollTop=saved;else if(saved||window.scrollY)window.scrollTo(0,saved);restoring=false;},0);
  const onScroll=()=>{if(!restoring)save();};
  window.addEventListener('scroll',onScroll,true);
  window.addEventListener('aethelgard:before-navigation',save);
  window.addEventListener('pagehide',save);
  return()=>{window.clearTimeout(timer);window.removeEventListener('scroll',onScroll,true);window.removeEventListener('aethelgard:before-navigation',save);window.removeEventListener('pagehide',save);};
 },[key,screen]);
}

export function ScreenScrollRestorer({screen}:{screen:string}){
 const id=getTelegramUser().id;useScreenScroll(`aethelgard_navigation_${id}_${readResetVersion(id)}`,screen);return null;
}
