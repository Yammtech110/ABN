import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── Global crash guards ──────────────────────────────────────────────────
// Errors thrown outside React's render tree (event handlers, async code,
// third-party scripts) never hit the ErrorBoundary — log them instead of
// letting them surface as uncaught, and keep the app running.
window.addEventListener('error', (event) => {
  console.error('[ABN] Uncaught error:', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[ABN] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

const rootElement = document.getElementById('root');

function renderFatalFallback(error: unknown) {
  if (!rootElement) return;
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0A0705;color:#F4E3D7;font-family:sans-serif;padding:24px;text-align:center;">
      <h1 style="color:#FFA048;margin-bottom:8px;">Something went wrong</h1>
      <p style="color:#9ca3af;font-size:14px;max-width:420px;">The app failed to start. Please reload the page. If the problem persists, clear your browser data for this site.</p>
      <button onclick="window.location.reload()" style="margin-top:20px;padding:10px 28px;background:#FFA048;color:#000;font-weight:bold;border:none;border-radius:8px;cursor:pointer;">Reload</button>
    </div>
  `;
  console.error('[ABN] Fatal boot error:', error);
}

try {
  createRoot(rootElement!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  renderFatalFallback(err);
}
