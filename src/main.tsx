import {readInterfaceStyle} from './context/InterfaceContext';
import { getLanguage } from './i18n/locale';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/mobile.css';

document.documentElement.lang = getLanguage();
document.documentElement.dataset.interface = readInterfaceStyle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
