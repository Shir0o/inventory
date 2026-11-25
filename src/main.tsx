import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { reactErrorHandler } from '@sentry/react';
import App from './App.tsx';
import './index.css';
import { FirebaseProvider } from './context/FirebaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';
import { initSentry } from './lib/sentry';

initSentry();

// Register service worker for PWA caching & auto-updates
registerSW({ immediate: true });


createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    </ErrorBoundary>
  </StrictMode>,
);
