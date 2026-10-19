import { useState } from 'react';
import { api, localToday } from '../api/client.js';
import { useToast } from './Toasts.jsx';

export default function EntryForm({ onSaved }) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(localToday);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      // The server chunks + embeds the text before responding, so this takes about a second.
      const { chunkCount } = await api.post('/api/entries', { content, entryDate });
      setContent('');
      toast.success(`Entry saved and embedded (${chunkCount} chunk${chunkCount === 1 ? '' : 's'}).`);
      await onSaved();
    } catch (err) {
      toast.error(`Could not save the entry: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      <h2>New entry</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What happened today?"
        rows={8}
        maxLength={10000}
        required
      />
      <div className="row">
        <input
          type="date"
          value={entryDate}
          max={localToday()}
          onChange={(e) => setEntryDate(e.target.value)}
          required
        />
        <span className="spacer" />
        <button type="submit" className="primary" disabled={saving || !content.trim()}>
          {saving ? 'Saving...' : 'Save entry'}
        </button>
      </div>
    </form>
  );
}
