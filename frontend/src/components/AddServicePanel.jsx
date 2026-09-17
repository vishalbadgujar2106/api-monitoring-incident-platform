import { useState } from 'react';
import { createService } from '../api/services.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const initialForm = {
  name: '',
  url: '',
  method: 'GET',
  expectedStatus: 200,
  checkIntervalSeconds: 60,
  timeoutMs: 5000,
};

export function AddServicePanel({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await createService({
        name: form.name,
        url: form.url,
        method: form.method,
        expected_status: Number(form.expectedStatus),
        check_interval_seconds: Number(form.checkIntervalSeconds),
        timeout_ms: Number(form.timeoutMs),
      });
      setForm(initialForm);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel-overlay" role="presentation" onClick={onClose}>
      <aside
        className="add-service-panel"
        role="dialog"
        aria-label="Add service"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="add-service-panel__header">
          <h2>Add Service</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <form className="add-service-panel__form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              required
              maxLength={255}
            />
          </label>

          <label>
            <span>URL</span>
            <input
              type="url"
              value={form.url}
              onChange={(event) => updateField('url', event.target.value)}
              placeholder="https://api.example.com/health"
              required
            />
          </label>

          <div className="add-service-panel__row">
            <label>
              <span>Method</span>
              <select value={form.method} onChange={(event) => updateField('method', event.target.value)}>
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Expected Status</span>
              <input
                type="number"
                min={100}
                max={599}
                value={form.expectedStatus}
                onChange={(event) => updateField('expectedStatus', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="add-service-panel__row">
            <label>
              <span>Check Interval (s)</span>
              <input
                type="number"
                min={10}
                max={86400}
                value={form.checkIntervalSeconds}
                onChange={(event) => updateField('checkIntervalSeconds', event.target.value)}
                required
              />
            </label>

            <label>
              <span>Timeout (ms)</span>
              <input
                type="number"
                min={100}
                max={30000}
                value={form.timeoutMs}
                onChange={(event) => updateField('timeoutMs', event.target.value)}
                required
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add Service'}
          </button>
        </form>
      </aside>
    </div>
  );
}
