import { formatClockTime, formatDuration } from '../lib/format.js';

const RANGE_MS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  all: null,
};

const RANGE_LABEL = {
  '1h': 'last hour',
  '6h': 'last 6 hours',
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  all: 'all time',
};

function TimelineEntry({ incident, now }) {
  const isOpen = incident.status === 'open';
  const endTime = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : now;
  const durationMs = endTime - new Date(incident.startedAt).getTime();

  return (
    <li className={`timeline-entry timeline-entry--${incident.status}`}>
      <span className="timeline-entry__rail" aria-hidden="true" />
      <div className="timeline-entry__content">
        <div className="timeline-entry__row">
          <span className="timeline-entry__service">{incident.service?.name ?? incident.serviceId}</span>
          <span className={`chip chip--${incident.status}`}>{isOpen ? 'OPEN' : 'RESOLVED'}</span>
        </div>
        <span className="timeline-entry__meta">
          {formatClockTime(incident.startedAt)} · {incident.failureCount} failure
          {incident.failureCount === 1 ? '' : 's'} · {isOpen ? 'ongoing' : 'mttr'} {formatDuration(durationMs)}
        </span>
      </div>
    </li>
  );
}

export function IncidentTimeline({ incidents, now, timeRange = 'all', title = 'Incident Activity' }) {
  const list = incidents ?? [];
  const windowMs = RANGE_MS[timeRange];
  const cutoff = windowMs && now ? now - windowMs : null;
  const filtered = cutoff ? list.filter((incident) => new Date(incident.startedAt).getTime() >= cutoff) : list;

  return (
    <section className="panel incident-timeline" aria-label={title}>
      <header className="panel__header">
        <h2>{title}</h2>
        <span className="panel__count">{filtered.length}</span>
      </header>
      <p className="panel__subtitle">Showing {RANGE_LABEL[timeRange]}</p>

      {incidents === null ? (
        <p className="empty-state">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No incidents in this window.</p>
      ) : (
        <ul className="timeline-entry__list">
          {filtered.map((incident) => (
            <TimelineEntry key={incident.id} incident={incident} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
