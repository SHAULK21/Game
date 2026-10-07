import React, {createContext, useCallback, useContext, useLayoutEffect, useRef, useState} from 'react';

export type InterfaceStyle = 'modern' | 'fantasy' | 'fantasy-beta';
export const INTERFACE_KEY = 'aethelgard_interface_style';
export const isInterfaceStyle = (value: unknown): value is InterfaceStyle => value === 'modern' || value === 'fantasy' || value === 'fantasy-beta';
export const readInterfaceStyle = (): InterfaceStyle => {
  try { const saved = localStorage.getItem(INTERFACE_KEY); return isInterfaceStyle(saved) ? saved : 'modern'; }
  catch { return 'modern'; }
};
export type SwitchPolicy = {commit?: () => void;getBlockReason: () => string; save: () => void};
type InterfaceState = {style: InterfaceStyle; setStyle: (next: InterfaceStyle) => boolean; registerDraftSave: (save: () => void) => () => void; registerSwitchPolicy: (policy: SwitchPolicy) => () => void; setBlockReason: (reason: string) => void; blockReason: string; error: string; switching: boolean};
const InterfaceContext = createContext<InterfaceState>({style:'modern',setStyle:()=>false,registerDraftSave:()=>()=>{},registerSwitchPolicy:()=>()=>{},setBlockReason:()=>{},blockReason:'',error:'',switching:false});
export const InterfaceProvider: React.FC<React.PropsWithChildren<{reload?: () => void}>> = ({children, reload = () => window.location.reload()}) => {
  // Fixed for this document: a switch takes effect only on the next page load.
  const [style] = useState<InterfaceStyle>(readInterfaceStyle);
  const [blockReason,setBlockReason] = useState('Дождитесь загрузки персонажа.');
  const [error,setError] = useState(''), [switching,setSwitching] = useState(false);
  const policy = useRef<SwitchPolicy | null>(null), switchingRef = useRef(false);
  const draftSaves = useRef(new Set<() => void>());
  const registerDraftSave = useCallback((save: () => void) => { draftSaves.current.add(save); return () => { draftSaves.current.delete(save); }; }, []);
  const registerSwitchPolicy = useCallback((next: SwitchPolicy) => {
    policy.current = next;
    return () => { if (policy.current === next) policy.current = null; };
  }, []);
  const setStyle = useCallback((next: InterfaceStyle) => {
    if (!isInterfaceStyle(next) || next === style || switchingRef.current) return false;
    // Commit pending React updates before reading the snapshot and action guards.
    policy.current?.commit?.();
    const reason = policy.current?.getBlockReason() ?? 'Дождитесь загрузки персонажа.';
    if (reason) { setError(reason); return false; }
    try {
      policy.current!.save();
      draftSaves.current.forEach(save => save());
      localStorage.setItem(INTERFACE_KEY,next);
      if (localStorage.getItem(INTERFACE_KEY) !== next) throw new Error('Не удалось сохранить настройку интерфейса.');
      switchingRef.current = true; setSwitching(true); setError('');
      reload(); return true;
    } catch (failure) {
      switchingRef.current = false; setSwitching(false);
      setError(failure instanceof Error && failure.name !== 'QuotaExceededError' && failure.name !== 'SecurityError' ? failure.message : 'Не удалось сохранить прогресс. Переключение отменено.');
      return false;
    }
  }, [style,reload]);
  useLayoutEffect(() => { document.documentElement.dataset.interface = style; }, [style]);
  return <InterfaceContext.Provider value={{style,setStyle,registerDraftSave,registerSwitchPolicy,setBlockReason,blockReason,error,switching}}>{children}</InterfaceContext.Provider>;
};
export const useInterface = () => useContext(InterfaceContext);
