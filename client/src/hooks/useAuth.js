import { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client.js';
import { useToast } from '../components/Toasts.jsx';

// status: 'checking' (validating a stored token) | 'anonymous' | 'authenticated'
export function useAuth() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'checking' : 'anonymous'));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Any 401 from the API (expired or invalid token) logs the user out with a notice.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast.info('Your session has expired. Please log in again.');
    });
  }, [logout, toast]);

  // On page load, check a stored token is still valid before showing the journal.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/api/auth/me')
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(logout);
  }, [logout]);

  // mode: 'login' | 'signup'
  const authenticate = useCallback(
    async (mode, email, password) => {
      const { token, user: me } = await api.post(`/api/auth/${mode}`, { email, password });
      tokenStore.set(token);
      setUser(me);
      setStatus('authenticated');
      toast.success(mode === 'signup' ? 'Account created. Welcome!' : 'Welcome back!');
    },
    [toast],
  );

  const userLogout = useCallback(() => {
    logout();
    toast.info('You have been logged out.');
  }, [logout, toast]);

  return { user, status, authenticate, logout: userLogout };
}
