import { getLanguage } from './i18n/locale';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './interfaces/modern/modern.css';
import './interfaces/fantasy/fantasy.css';
import './interfaces/fantasy/fantasy-beta.css';
import './styles/mobile.css';

document.documentElement.lang = getLanguage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
