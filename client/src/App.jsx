import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client.js';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';
import EntryForm from './components/EntryForm.jsx';
import EntryList from './components/EntryList.jsx';
import { useToast } from './components/Toasts.jsx';
import { useAuth } from './hooks/useAuth.js';

export default function App() {
  const { user, status, authenticate, logout } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  // The entry a chat source points at; EntryList scrolls to it and highlights it.
  const [highlightId, setHighlightId] = useState(null);

  const loadEntries = useCallback(async () => {
    try {
      const data = await api.get('/api/entries');
      setEntries(data.entries);
    } catch (err) {
      toast.error(`Could not load entries: ${err.message}`);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'authenticated') loadEntries();
    else setEntries([]);
  }, [status, loadEntries]);

  if (status === 'checking') return <p className="center muted">Loading...</p>;
  if (status !== 'authenticated') return <AuthForm onSubmit={authenticate} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">AJ</div>
        <h1 className="brand">
          AI <span>Journal</span>
        </h1>
        <span className="spacer" />
        <div className="user-pill">
          <div className="avatar">{user.email[0]}</div>
          <span>{user.email}</span>
        </div>
        <button type="button" className="small" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="columns">
        <section className="panel">
          <EntryForm onSaved={loadEntries} />
          <EntryList entries={entries} onChanged={loadEntries} highlightId={highlightId} />
        </section>
        <section className="panel">
          <Chat onSourceClick={setHighlightId} />
        </section>
      </main>
    </div>
  );
}
