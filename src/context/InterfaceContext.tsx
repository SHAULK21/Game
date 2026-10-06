import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

export type InterfaceStyle = 'modern' | 'fantasy' | 'fantasy-beta';
export const INTERFACE_KEY = 'aethelgard_interface_style';
export const readInterfaceStyle = (): InterfaceStyle => {
  try {
    const saved = localStorage.getItem(INTERFACE_KEY);
    return saved === 'fantasy' || saved === 'fantasy-beta' ? saved : 'modern';
  }
  catch { return 'modern'; }
};
const InterfaceContext = createContext<{ style: InterfaceStyle; setStyle: (style: InterfaceStyle) => void }>({ style: 'modern', setStyle: () => {} });

export const InterfaceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [style, updateStyle] = useState<InterfaceStyle>(readInterfaceStyle);
  const setStyle = (next: InterfaceStyle) => {
    updateStyle(next);
    try { localStorage.setItem(INTERFACE_KEY, next); } catch { /* Still switch for this session. */ }
  };
  useLayoutEffect(() => { document.documentElement.dataset.interface = style; }, [style]);
  return <InterfaceContext.Provider value={{ style, setStyle }}>{children}</InterfaceContext.Provider>;
};
export const useInterface = () => useContext(InterfaceContext);
