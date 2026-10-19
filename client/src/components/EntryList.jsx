import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatDate } from '../dates.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import { useToast } from './Toasts.jsx';

export default function EntryList({ entries, onChanged, highlightId }) {
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ content: '', entryDate: '' });
  const [busyId, setBusyId] = useState(null);
  // The entry waiting for delete confirmation (null = dialog closed).
  const [pendingDelete, setPendingDelete] = useState(null);

  // When a chat source is clicked, scroll the list (not the page) to that entry.
  useEffect(() => {
    if (highlightId) {
      document.getElementById(`entry-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightId]);

  function startEdit(entry) {
    setEditingId(entry.id);
    setDraft({ content: entry.content, entryDate: entry.entryDate });
  }

  async function save(id) {
    setBusyId(id);
    try {
      const { chunkCount } = await api.put(`/api/entries/${id}`, draft);
      setEditingId(null);
      toast.success(`Entry updated and re-embedded (${chunkCount} chunk${chunkCount === 1 ? '' : 's'}).`);
      await onChanged();
    } catch (err) {
      toast.error(`Could not update the entry: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const entry = pendingDelete;
    setBusyId(entry.id);
    try {
      await api.del(`/api/entries/${entry.id}`);
      setPendingDelete(null);
      toast.success('Entry deleted. The AI can no longer recall it.');
      await onChanged();
    } catch (err) {
      setPendingDelete(null);
      toast.error(`Could not delete the entry: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="panel-header row">
        <h2>Past entries</h2>
        <span className="count">{entries.length}</span>
      </div>
      <div className="scroll">
        {entries.length === 0 && <p className="empty">No entries yet. Write your first one above.</p>}
        <ul className="entries">
          {entries.map((entry) =>
            editingId === entry.id ? (
              <li key={entry.id} id={`entry-${entry.id}`} className="entry editing">
                <input
                  type="date"
                  value={draft.entryDate}
                  onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })}
                />
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  rows={9}
                />
                <div className="row">
                  <button
                    type="button"
                    className="small primary"
                    onClick={() => save(entry.id)}
                    disabled={busyId === entry.id || !draft.content.trim()}
                  >
                    {busyId === entry.id ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="small" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={entry.id}
                id={`entry-${entry.id}`}
                className={`entry${entry.id === highlightId ? ' highlight' : ''}`}
              >
                <div className="entry-date">{formatDate(entry.entryDate)}</div>
                <p className="entry-content">{entry.content}</p>
                <div className="row">
                  <button
                    type="button"
                    className="small"
                    onClick={() => startEdit(entry)}
                    disabled={busyId === entry.id}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => setPendingDelete(entry)}
                    disabled={busyId === entry.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `The entry from ${formatDate(pendingDelete.entryDate)} and its embeddings will be removed permanently. The AI will no longer be able to recall it.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={pendingDelete !== null && busyId === pendingDelete.id}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
