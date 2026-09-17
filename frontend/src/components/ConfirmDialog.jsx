export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'default',
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="panel-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p className="confirm-dialog__message">{message}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
