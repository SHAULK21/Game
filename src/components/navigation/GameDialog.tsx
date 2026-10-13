import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {t} from '../../i18n/locale';
export function GameDialog({title,onClose,children,className=''}:React.PropsWithChildren<{title:string;onClose:()=>void;className?:string}>){
 const panel=useRef<HTMLElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const siblings=Array.from(document.body.children).filter(el=>el!==panel.current?.parentElement) as HTMLElement[];
  const inert=siblings.map(el=>el.inert===true);siblings.forEach(el=>el.inert=true);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();closeRef.current();}if(e.key!=='Tab')return;const nodes=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]');const list=Array.from(nodes||[]).filter(el=>!el.closest('[hidden]')&&(!el.closest('details')||el.tagName==='SUMMARY'||el.closest('details')?.open));if(!list.length)return;const first=list[0],last=list.at(-1)!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;siblings.forEach((el,i)=>el.inert=inert[i]);document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<div className="game-dialog-backdrop" onClick={onClose}><section ref={panel} className={`game-reference-dialog ${className}`} role="dialog" aria-modal="true" aria-label={t(title)} onClick={e=>e.stopPropagation()}>{children}</section></div>,document.body);
}
