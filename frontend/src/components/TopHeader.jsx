import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle.jsx';

// Kept in sync with the ranges GET /api/dashboard/metrics supports.
const TIME_RANGES = [
  { key: '1h', label: 'Last hour' },
  { key: '6h', label: 'Last 6 hours' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
];

export function TopHeader({
  searchQuery,
  onSearchChange,
  timeRange,
  onTimeRangeChange,
  openIncidents,
  onAddService,
  theme,
  onThemeChange,
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const openList = openIncidents ?? [];

  return (
    <header className="top-header">
      <div className="top-header__search">
        <span className="top-header__search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search services…"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search services"
        />
      </div>

      <div className="top-header__actions">
        <label className="time-range">
          <span className="sr-only">Time range</span>
          <select value={timeRange} onChange={(event) => onTimeRangeChange(event.target.value)}>
            {TIME_RANGES.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </label>

        <ThemeToggle theme={theme} onChange={onThemeChange} />

        <div className="notif">
          <button
            type="button"
            className="icon-btn notif__trigger"
            onClick={() => setIsNotifOpen((open) => !open)}
            aria-label={`${openList.length} open incidents`}
            aria-expanded={isNotifOpen}
          >
            <span aria-hidden="true">🔔</span>
            {openList.length > 0 && <span className="notif__badge">{openList.length}</span>}
          </button>

          {isNotifOpen && (
            <div className="notif__panel" role="menu">
              <div className="notif__panel-header">Open Incidents</div>
              {openList.length === 0 ? (
                <p className="notif__empty">Nothing open right now.</p>
              ) : (
                <ul className="notif__list">
                  {openList.map((incident) => (
                    <li key={incident.id}>
                      <span className="notif__service">{incident.service?.name ?? incident.serviceId}</span>
                      <span className="notif__meta">{incident.failureCount} failures</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button type="button" className="btn btn--primary" onClick={onAddService}>
          + Add Service
        </button>
      </div>
    </header>
  );
}
