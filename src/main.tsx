import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/speak.css';
import './styles/screens.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Offline app shell — production only, so it never gets in the way of development.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
