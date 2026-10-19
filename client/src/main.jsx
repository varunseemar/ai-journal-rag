import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Wraps the whole app so any component (and useAuth) can show toasts. */}
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
