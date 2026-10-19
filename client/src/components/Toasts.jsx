import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Toast notifications without a library: a React context holds the list of visible toasts,
// and any component can call toast.success('...') / toast.error('...') via useToast().
const ToastContext = createContext(null);

const ICONS = { success: '✓', error: '!', info: 'i' };
const DURATION_MS = { success: 3500, info: 4000, error: 6000 };
const MAX_VISIBLE = 4;

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION_MS[type]);
    },
    [dismiss],
  );

  // Memoised so components using useToast() don't re-render every time a toast appears.
  const toast = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* aria-live: screen readers announce new toasts */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} type="button" className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return toast;
}
