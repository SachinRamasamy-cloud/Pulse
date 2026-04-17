import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// HashRouter compatibility: rewrite legacy path URLs (e.g. /success?session_id=...)
// to hash URLs before the app mounts.
if (!window.location.hash && window.location.pathname !== '/') {
  const next = `/#${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', next);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
