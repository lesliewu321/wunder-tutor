import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useStore } from './state/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/speak.css';
import './styles/screens.css';
import './styles/tablet.css';

// Dev-only handle for poking at state from the console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);

// Offline app shell — production only, so it never gets in the way of development.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
