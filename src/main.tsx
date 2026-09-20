import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useStore } from './state/store';
import { startAccount } from './account/account';
import { isApp } from './platform';
import './styles/tokens.css';
import './styles/base.css';
import './styles/speak.css';
import './styles/screens.css';
import './styles/tablet.css';

// Dev-only handle for poking at state from the console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);

// A family with an account: keep its devices the same. (Nothing is loaded for a family without one.)
startAccount();

// Offline app shell — production website only. The phone app already carries every file on the device, and a service
// worker there would only serve a second, stale copy of them.
if (import.meta.env.PROD && !isApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
