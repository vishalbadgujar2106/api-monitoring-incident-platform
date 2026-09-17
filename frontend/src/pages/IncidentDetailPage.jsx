import { useState } from 'react';
import { KpiBlock } from '../components/KpiBlock.jsx';
import { StatusDot } from '../components/StatusDot.jsx';
import { analyzeIncident, getIncident } from '../api/incidents.js';
import { usePolling } from '../hooks/usePolling.js';
import { formatClockTime, formatDuration, formatResponseTime } from '../lib/format.js';

const POLL_INTERVAL_MS = 15000;

// A run shorter than this stays as individual rows — collapsing just 1-2
// checks wouldn't reduce noise and would only hide detail for no benefit.
const MIN_GROUP_SIZE = 3;

// Consecutive checks collapse into one group only while status, statusCode,
// and errorMessage all stay identical — the moment any of those changes,
// that's a real event (recovery, a different failure mode, etc.) and must
// start a new row of its own, per requirement 1.
function groupConsecutiveChecks(checks) {
  const groups = [];
  let run = [];

  function flush() {
    if (run.length === 0) return;
    if (run.length >= MIN_GROUP_SIZE) {
      groups.push({ type: 'group', checks: run });
    } else {
      for (const check of run) groups.push({ type: 'single', check });
    }
    run = [];
  }

  for (const check of checks) {
    const last = run[run.length - 1];
    const sameAsLast =
      last &&
      last.status === check.status &&
      last.statusCode === check.statusCode &&
      last.errorMessage === check.errorMessage;

    if (sameAsLast) {
      run.push(check);
    } else {
      flush();
      run = [check];
    }
  }
  flush();

  return groups;
}

function summarizeResponseTimes(checks) {
  const values = checks.map((check) => check.responseTimeMs).filter((value) => typeof value === 'number');
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  };
}

// Merges the incident's start/resolve moments with its surrounding health
// checks into one chronological story: failure started -> repeated
// failures -> recovery -> resolved. When `grouped` is true, runs of 3+
// consecutive identical checks collapse into a single summary row.
function buildTimelineEvents(incident, { grouped }) {
  const checks = incident.healthChecks ?? [];

  const checkEvents = grouped
    ? groupConsecutiveChecks(checks).map((entry) =>
        entry.type === 'group'
          ? { kind: 'group', at: entry.checks[0].checkedAt, checks: entry.checks }
          : { kind: 'check', at: entry.check.checkedAt, check: entry.check },
      )
    : checks.map((check) => ({ kind: 'check', at: check.checkedAt, check }));

  const events = [{ kind: 'started', at: incident.startedAt }, ...checkEvents];
  if (incident.resolvedAt) {
    events.push({ kind: 'resolved', at: incident.resolvedAt });
  }
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function CheckEventRow({ check }) {
  return (
    <li className={`timeline-entry timeline-entry--${check.status}`}>
      <span className="timeline-entry__rail" aria-hidden="true" />
      <div className="timeline-entry__content">
        <div className="timeline-entry__row">
          <span className={`chip chip--${check.status}`}>
            <StatusDot status={check.status} />
            {check.status}
          </span>
          <span className="timeline-entry__meta">{formatClockTime(check.checkedAt)}</span>
        </div>
        <div className="timeline-entry__stats">
          <span className="timeline-entry__stat">code {check.statusCode ?? '—'}</span>
          <span className="timeline-entry__stat-divider" aria-hidden="true">
            ·
          </span>
          <span className="timeline-entry__stat">{formatResponseTime(check.responseTimeMs)}</span>
          {check.errorMessage && (
            <>
              <span className="timeline-entry__stat-divider" aria-hidden="true">
                ·
              </span>
              <span className="timeline-entry__stat timeline-entry__stat--error" title={check.errorMessage}>
                {check.errorMessage}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function GroupEventRow({ checks }) {
  const first = checks[0];
  const last = checks[checks.length - 1];
  const stats = summarizeResponseTimes(checks);
  const noun = first.status === 'down' ? 'failures' : 'successes';
  const timeRange = `${formatClockTime(first.checkedAt)}–${formatClockTime(last.checkedAt)}`;

  return (
    <li className={`timeline-entry timeline-entry--${first.status}`}>
      <span className="timeline-entry__rail" aria-hidden="true" />
      <div className="timeline-entry__content">
        <div className="timeline-entry__row">
          <span className="timeline-entry__service">
            {checks.length} repeated {noun} · {timeRange}
          </span>
          <span className={`chip chip--${first.status}`}>
            <StatusDot status={first.status} />
            {checks.length}×
          </span>
        </div>
        <div className="timeline-entry__stats">
          <span className="timeline-entry__stat">code {first.statusCode ?? '—'}</span>
          <span className="timeline-entry__stat-divider" aria-hidden="true">
            ·
          </span>
          <span className="timeline-entry__stat">
            {stats
              ? `min ${formatResponseTime(stats.min)} · avg ${formatResponseTime(stats.avg)} · max ${formatResponseTime(stats.max)}`
              : 'no response time data'}
          </span>
          {first.errorMessage && (
            <>
              <span className="timeline-entry__stat-divider" aria-hidden="true">
                ·
              </span>
              <span className="timeline-entry__stat timeline-entry__stat--error" title={first.errorMessage}>
                {first.errorMessage}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function MarkerRow({ tone, label, chipLabel, at, meta }) {
  return (
    <li className={`timeline-entry timeline-entry--${tone}`}>
      <span className="timeline-entry__rail" aria-hidden="true" />
      <div className="timeline-entry__content">
        <div className="timeline-entry__row">
          <span className="timeline-entry__service">{label}</span>
          <span className={`chip chip--${tone}`}>{chipLabel}</span>
        </div>
        <span className="timeline-entry__meta">
          {formatClockTime(at)} · {meta}
        </span>
      </div>
    </li>
  );
}

function AiAnalysisPanel({ incidentId }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  // V1: analysis is generated on demand and never persisted to Postgres,
  // so it only lives here for as long as this page is open — a refresh
  // or navigating away loses it, and re-running calls the AI again.
  const [analysis, setAnalysis] = useState(null);
  const [lastIncidentId, setLastIncidentId] = useState(incidentId);

  // Adjust state during render rather than in an effect (avoids an extra
  // render pass) if the panel is ever reused for a different incident
  // without unmounting.
  if (incidentId !== lastIncidentId) {
    setLastIncidentId(incidentId);
    setAnalysis(null);
    setError(null);
  }

  const hasAnalysis = Boolean(analysis);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeIncident(incidentId);
      setAnalysis({ rootCauseSummary: result.rootCauseSummary, suggestedSteps: result.suggestedSteps });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <section className="panel ai-analysis-panel">
      <header className="panel__header">
        <h2>AI Incident Analysis</h2>
        <div className="panel__header-actions">
          <button type="button" className="btn btn--primary" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? 'Analyzing…' : hasAnalysis ? 'Re-analyze' : 'Analyze with AI'}
          </button>
        </div>
      </header>

      {error && <p className="banner banner--error">Couldn't run AI analysis. {error}</p>}

      {!hasAnalysis && !error && (
        <p className="empty-state">
          No analysis yet — run it to get a likely root cause and suggested next steps from this
          incident's health-check history. Analysis is generated on demand and isn't saved.
        </p>
      )}

      {hasAnalysis && (
        <div className="ai-analysis-panel__body">
          <div className="ai-analysis-panel__section">
            <h3>Likely root cause</h3>
            <p>{analysis.rootCauseSummary}</p>
          </div>
          <div className="ai-analysis-panel__section">
            <h3>Suggested next steps</h3>
            <p className="ai-analysis-panel__steps">{analysis.suggestedSteps}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function IncidentDetailPage({ incidentId, onBack, onOpenService }) {
  const [isGrouped, setIsGrouped] = useState(true);

  const detailPoll = usePolling(() => getIncident(incidentId), {
    intervalMs: POLL_INTERVAL_MS,
    key: incidentId,
  });

  const incident = detailPoll.data;
  const isNotFound = detailPoll.error?.status === 404;

  const backLink = (
    <button type="button" className="back-link" onClick={onBack}>
      ← Back
    </button>
  );

  if (isNotFound) {
    return (
      <div className="service-detail">
        {backLink}
        <section className="panel">
          <p className="empty-state">
            This incident no longer exists — it may have been removed along with its service.
          </p>
        </section>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="service-detail">
        {backLink}
        {detailPoll.error ? (
          <p className="banner banner--error">Couldn't load this incident. {detailPoll.error.message}</p>
        ) : (
          <p className="empty-state">Loading…</p>
        )}
      </div>
    );
  }

  const isOpen = incident.status === 'open';
  const endTime = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : detailPoll.lastUpdatedAt;
  const durationMs = endTime - new Date(incident.startedAt).getTime();
  const events = buildTimelineEvents(incident, { grouped: isGrouped });
  const hasChecks = (incident.healthChecks ?? []).length > 0;
  const canToggle = hasChecks && groupConsecutiveChecks(incident.healthChecks).some((entry) => entry.type === 'group');

  return (
    <div className="service-detail">
      {backLink}

      {detailPoll.error && (
        <p className="banner banner--error">Couldn't refresh this incident. Showing the last known data.</p>
      )}

      <section className="panel service-detail__header">
        <div className="service-detail__title-row">
          <div className="service-detail__title">
            <span className={`chip chip--${incident.status}`}>{isOpen ? 'OPEN' : 'RESOLVED'}</span>
            <h2>{incident.service?.name ?? 'Unknown service'}</h2>
          </div>
          <div className="service-detail__actions">
            <button type="button" className="btn btn--ghost" onClick={() => onOpenService(incident.serviceId)}>
              View Service
            </button>
          </div>
        </div>

        {incident.service && (
          <p className="service-detail__url">
            <span className="chip chip--active">{incident.service.method}</span> {incident.service.url}
          </p>
        )}

        <div className="kpi-row">
          <KpiBlock label="Status" tone={isOpen ? 'down' : 'up'} value={isOpen ? 'Open' : 'Resolved'} />
          <KpiBlock label="Started" value={formatClockTime(incident.startedAt)} />
          <KpiBlock
            label="Resolved"
            value={incident.resolvedAt ? formatClockTime(incident.resolvedAt) : 'Ongoing'}
          />
          <KpiBlock label={isOpen ? 'Ongoing For' : 'MTTR'} value={formatDuration(durationMs)} />
          <KpiBlock label="Failure Count" value={incident.failureCount} />
        </div>
      </section>

      <AiAnalysisPanel incidentId={incident.id} />

      <section className={`panel incident-panel ${isOpen ? 'incident-panel--alert' : ''}`}>
        <header className="panel__header">
          <h2>Incident Timeline</h2>
          <div className="panel__header-actions">
            {canToggle && (
              <button type="button" className="timeline-toggle-btn" onClick={() => setIsGrouped((g) => !g)}>
                {isGrouped ? 'Show all checks' : 'Collapse checks'}
              </button>
            )}
            <span className={`panel__count ${isOpen ? 'panel__count--alert' : ''}`}>{events.length}</span>
          </div>
        </header>

        {!hasChecks && (
          <p className="panel__subtitle">No health checks were recorded in the window around this incident.</p>
        )}

        <ul className="timeline-entry__list">
          {events.map((event, index) => {
            if (event.kind === 'started') {
              return (
                <MarkerRow
                  key={`started-${index}`}
                  tone="open"
                  label="Failure detected"
                  chipLabel="STARTED"
                  at={event.at}
                  meta="incident opened"
                />
              );
            }
            if (event.kind === 'resolved') {
              return (
                <MarkerRow
                  key={`resolved-${index}`}
                  tone="resolved"
                  label="Recovered"
                  chipLabel="RESOLVED"
                  at={event.at}
                  meta="service back to normal"
                />
              );
            }
            if (event.kind === 'group') {
              return <GroupEventRow key={`group-${event.checks[0].id}`} checks={event.checks} />;
            }
            return <CheckEventRow key={event.check.id} check={event.check} />;
          })}

          {isOpen && (
            <li className="timeline-entry timeline-entry--open">
              <span className="timeline-entry__rail" aria-hidden="true" />
              <div className="timeline-entry__content">
                <div className="timeline-entry__row">
                  <span className="timeline-entry__service">Still open</span>
                </div>
                <span className="timeline-entry__meta">No resolution yet — monitoring continues.</span>
              </div>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
