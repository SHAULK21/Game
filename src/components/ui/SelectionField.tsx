import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useInterface} from '../../context/InterfaceContext';
import {t, useLocale} from '../../i18n/locale';

type Choice = {value:string; label:string; disabled:boolean; group?:string};
function choicesFrom(children:React.ReactNode, group?:string, groupDisabled=false):Choice[] {
 const choices:Choice[]=[];
 React.Children.forEach(children, child=>{
  if (!React.isValidElement(child)) return;
  const p=child.props as {value?:string|number; children?:React.ReactNode; disabled?:boolean; label?:string};
  if(child.type==='option')choices.push({value:String(p.value??p.children??''),label:React.Children.toArray(p.children).join(''),disabled:groupDisabled||!!p.disabled,group});
  else choices.push(...choicesFrom(p.children,child.type==='optgroup'?p.label:group,groupDisabled||!!p.disabled));
 });
 return choices;
}
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {renderChoice?:(value:string)=>React.ReactNode};
/** Modern searchable dialog, with a native select retained for forms and the fantasy theme. */
export function SelectionField({renderChoice,...props}:Props) {
 useLocale();
 const {style}=useInterface();
 const [open,setOpen]=useState(false), [query,setQuery]=useState('');
 const trigger=useRef<HTMLButtonElement>(null), panel=useRef<HTMLDivElement>(null), select=useRef<HTMLSelectElement>(null);
 const id=useId();
 const choices=choicesFrom(props.children);
 const selected=choices.find(c=>c.value===String(props.value??props.defaultValue??''));
 const title=props['aria-label']||t('Выберите вариант');
 const visible=choices.filter(c=>(c.value!==''||!c.disabled)&&c.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 useEffect(()=>{if(props.disabled||style==='fantasy')setOpen(false);},[props.disabled,style]);
 useEffect(()=>{
  if(!open)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  panel.current?.querySelector<HTMLInputElement>('input')?.focus();
  const keys=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);return;}
   if(!panel.current?.contains(document.activeElement))return;
   const options=Array.from(panel.current.querySelectorAll<HTMLButtonElement>('[role=option]:not(:disabled)'));
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();const index=options.indexOf(document.activeElement as HTMLButtonElement);
    options[(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
   }
   if(e.key==='Tab'){
    const controls=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
    const first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',keys,true);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keys,true);if(trigger.current?.isConnected)trigger.current.focus();};
 },[open]);
 const choose=(choice:Choice)=>{
  if(choice.disabled||props.disabled||!select.current)return;
  select.current.value=choice.value;
  select.current.dispatchEvent(new Event('change', {bubbles:true}));
  setOpen(false);
 };
 if(style==='fantasy'||props.multiple)return <select {...props}/>;
 return <>
  <select {...props} ref={select} hidden aria-hidden="true" tabIndex={-1}/>
  <button type="button" ref={trigger} className={`selection-trigger ${props.className||''}`} disabled={props.disabled} aria-label={props['aria-label']} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{setQuery('');setOpen(true);}}>
   <span>{selected?(renderChoice?.(selected.value)||selected.label):t('Выберите вариант')}</span><span aria-hidden="true" className="selection-chevron">⌄</span>
  </button>
  {open&&createPortal(<div className="selection-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label={title} className="selection-dialog">
    <header><h2>{title}</h2><button type="button" aria-label={t('Закрыть')} onClick={()=>setOpen(false)}>×</button></header>
    <input type="search" aria-label={t('Поиск в списке')} placeholder={t('Поиск в списке')} value={query} onChange={e=>setQuery(e.target.value)}/>
    <p className="selection-count">{t('Найдено: ')}{visible.length}</p>
    <div role="listbox" aria-label={title} className="selection-options">
     {visible.map(c=><button type="button" key={c.value} role="option" aria-selected={selected?.value===c.value} disabled={c.disabled} onClick={()=>choose(c)} className="selection-option">
      <span>{c.group&&<small>{c.group}</small>}{renderChoice?.(c.value)||c.label}</span><span aria-hidden="true" className="selection-check">{selected?.value===c.value?'✓':''}</span>
     </button>)}
     {!visible.length&&<p role="status" className="selection-empty">{t('Ничего не найдено')}</p>}
    </div>
   </div>
  </div>,document.body)}
 </>;
}
