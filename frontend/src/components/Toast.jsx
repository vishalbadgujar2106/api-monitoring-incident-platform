export function Toast({ toast, onDismiss }) {
  if (!toast) return null;

  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span>{toast.message}</span>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
