import { KpiBlock } from '../components/KpiBlock.jsx';
import { Sparkline } from '../components/Sparkline.jsx';
import { StatusDot } from '../components/StatusDot.jsx';
import { getService } from '../api/services.js';
import { usePolling } from '../hooks/usePolling.js';
import {
  formatClockTime,
  formatDuration,
  formatRelativeTime,
  formatResponseTime,
  formatUptime,
} from '../lib/format.js';

const POLL_INTERVAL_MS = 15000;

const RANGE_LABEL = {
  '1h': 'last hour',
  '6h': 'last 6 hours',
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
};

function buildPointLabels(series, field, formatValue) {
  return series.map((bucket) => {
    const time = formatClockTime(bucket.bucketStart);
    const value = bucket[field];
    return value === null ? `${time} · no data` : `${time} · ${formatValue(value)}`;
  });
}

function TrendChart({ title, rangeLabel, values, labels, color, formatValue }) {
  const points = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  const hasData = points.length >= 2;
  const min = points.length ? Math.min(...points) : null;
  const max = points.length ? Math.max(...points) : null;
  const latest = points.length ? points[points.length - 1] : null;

  return (
    <section className="panel chart-card">
      <header className="panel__header">
        <h2>{title}</h2>
        <span className="panel__count">{rangeLabel}</span>
      </header>
      <div className="chart-card__body">
        <Sparkline values={values} labels={labels} color={color} strokeWidth={2} />
        {!hasData && <div className="chart-card__empty">Not enough data yet for this range</div>}
      </div>
      {hasData && (
        <p className="chart-card__caption">
          Min {formatValue(min)} · Max {formatValue(max)} · Latest {formatValue(latest)}
        </p>
      )}
    </section>
  );
}

function RecentChecksTable({ checks }) {
  if (checks === null || checks === undefined) return <p className="empty-state">Loading…</p>;
  if (checks.length === 0) return <p className="empty-state">No health checks recorded yet.</p>;

  return (
    <div className="services-table__scroll services-table__scroll--capped">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Code</th>
            <th>Response</th>
            <th>Checked At</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>
                <span className={`chip chip--${check.status}`}>
                  <StatusDot status={check.status} />
                  {check.status}
                </span>
              </td>
              <td className="services-table__mono">{check.statusCode ?? '—'}</td>
              <td className="services-table__mono">{formatResponseTime(check.responseTimeMs)}</td>
              <td className="services-table__mono">{formatClockTime(check.checkedAt)}</td>
              <td className="services-table__error" title={check.errorMessage ?? ''}>
                {check.errorMessage ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentIncidentsList({ incidents, now, onOpenIncident }) {
  if (incidents === null || incidents === undefined) return <p className="empty-state">Loading…</p>;
  if (incidents.length === 0) {
    return <p className="empty-state">No incidents recorded for this service.</p>;
  }

  return (
    <ul className="timeline-entry__list">
      {incidents.map((incident) => {
        const isOpen = incident.status === 'open';
        const endTime = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : now;
        const durationMs = endTime - new Date(incident.startedAt).getTime();

        const body = (
          <>
            <div className="timeline-entry__row">
              <span className="timeline-entry__service">{formatClockTime(incident.startedAt)}</span>
              <span className={`chip chip--${incident.status}`}>{isOpen ? 'OPEN' : 'RESOLVED'}</span>
            </div>
            <div className="timeline-entry__stats">
              <span className="timeline-entry__stat">
                {incident.failureCount} failure{incident.failureCount === 1 ? '' : 's'}
              </span>
              <span className="timeline-entry__stat-divider" aria-hidden="true">
                ·
              </span>
              <span className={`timeline-entry__stat ${isOpen ? 'timeline-entry__stat--alert' : ''}`}>
                {isOpen ? 'ongoing' : 'mttr'} {formatDuration(durationMs)}
              </span>
            </div>
          </>
        );

        return (
          <li key={incident.id} className={`timeline-entry timeline-entry--${incident.status}`}>
            <span className="timeline-entry__rail" aria-hidden="true" />
            {onOpenIncident ? (
              <button
                type="button"
                className="timeline-entry__content timeline-entry__content--link"
                onClick={() => onOpenIncident(incident)}
              >
                {body}
              </button>
            ) : (
              <div className="timeline-entry__content">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ServiceDetailPage({
  serviceId,
  range,
  onBack,
  onEdit,
  onToggleActive,
  onDelete,
  onCheckNow,
  onOpenIncident,
  pendingServiceId,
}) {
  const detailPoll = usePolling(() => getService(serviceId, range), {
    intervalMs: POLL_INTERVAL_MS,
    key: `${serviceId}:${range}`,
  });

  const service = detailPoll.data;
  const isBusy = pendingServiceId === serviceId;
  const rangeLabel = RANGE_LABEL[range] ?? range;

  const backLink = (
    <button type="button" className="back-link" onClick={onBack}>
      ← Back to Services
    </button>
  );

  if (!service) {
    return (
      <div className="service-detail">
        {backLink}
        {detailPoll.error ? (
          <p className="banner banner--error">Couldn't load this service. {detailPoll.error.message}</p>
        ) : (
          <p className="empty-state">Loading…</p>
        )}
      </div>
    );
  }

  const series = service.series ?? [];
  const responseTimeSeries = series.map((bucket) => bucket.averageResponseTimeMs);
  const uptimeSeries = series.map((bucket) => bucket.uptimePercent);
  const responseTimeLabels = buildPointLabels(series, 'averageResponseTimeMs', formatResponseTime);
  const uptimeLabels = buildPointLabels(series, 'uptimePercent', formatUptime);

  const recentIncidents = service.recentIncidents ?? [];
  const hasOpenIncident = recentIncidents.some((incident) => incident.status === 'open');

  const statusTone = service.currentStatus === 'up' || service.currentStatus === 'down'
    ? service.currentStatus
    : undefined;

  return (
    <div className="service-detail">
      {backLink}

      {detailPoll.error && (
        <p className="banner banner--error">Couldn't refresh this service. Showing the last known data.</p>
      )}

      <section className="panel service-detail__header">
        <div className="service-detail__title-row">
          <div className="service-detail__title">
            <StatusDot status={service.currentStatus} />
            <h2>{service.name}</h2>
            <span className={`chip ${service.isActive ? 'chip--active' : 'chip--paused'}`}>
              {service.isActive ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <div className="service-detail__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onCheckNow(service)}
              disabled={isBusy}
            >
              {isBusy ? 'Working…' : 'Check now'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onEdit(service)}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onToggleActive(service)}
              disabled={isBusy}
            >
              {service.isActive ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(service)}
              disabled={isBusy}
            >
              Delete
            </button>
          </div>
        </div>

        <p className="service-detail__url">
          <span className="chip chip--active">{service.method}</span> {service.url}
        </p>

        <div className="kpi-row">
          <KpiBlock
            label="Status"
            tone={statusTone}
            value={
              <span className="status-label">
                <StatusDot status={service.currentStatus} />
                {service.currentStatus}
              </span>
            }
          />
          <KpiBlock label="Response Time" value={formatResponseTime(service.lastResponseTimeMs)} />
          <KpiBlock label={`Uptime · ${rangeLabel}`} value={formatUptime(service.uptimePercent)} />
          <KpiBlock label="Last Checked" value={formatRelativeTime(service.lastCheckedAt)} />
          <KpiBlock label="Check Interval" value={`${service.checkIntervalSeconds}s`} />
        </div>
      </section>

      <div className="overview-grid service-detail__trends">
        <TrendChart
          title="Response Time Trend"
          rangeLabel={rangeLabel}
          values={responseTimeSeries}
          labels={responseTimeLabels}
          color="var(--accent)"
          formatValue={formatResponseTime}
        />
        <TrendChart
          title="Uptime Trend"
          rangeLabel={rangeLabel}
          values={uptimeSeries}
          labels={uptimeLabels}
          color="var(--up)"
          formatValue={formatUptime}
        />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <header className="panel__header">
            <h2>Recent Health Checks</h2>
            <span className="panel__count">{service.recentHealthChecks?.length ?? 0}</span>
          </header>
          <RecentChecksTable checks={service.recentHealthChecks} />
        </section>

        <section className={`panel incident-panel ${hasOpenIncident ? 'incident-panel--alert' : ''}`}>
          <header className="panel__header">
            <h2>Recent Incidents</h2>
            <span className={`panel__count ${hasOpenIncident ? 'panel__count--alert' : ''}`}>
              {recentIncidents.length}
            </span>
          </header>
          <RecentIncidentsList
            incidents={service.recentIncidents}
            now={detailPoll.lastUpdatedAt}
            onOpenIncident={onOpenIncident}
          />
        </section>
      </div>
    </div>
  );
}
