import { useEffect, useRef } from 'react';

// A confirmation popup built on the native <dialog> element. showModal() gives us the dimmed
// backdrop, focus handling and closing with Esc for free, so no modal library is needed.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  // Keep the browser's dialog state in sync with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      // Esc key: let React state decide, instead of the browser closing it on its own.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      // A click on the backdrop lands on the <dialog> itself (the content is an inner div).
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onCancel();
      }}
    >
      <div className="dialog-body">
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'danger-solid' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
