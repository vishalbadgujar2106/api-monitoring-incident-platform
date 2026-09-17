import { Sparkline } from './Sparkline.jsx';

const RANGE_LABEL = {
  '1h': 'last hour',
  '6h': 'last 6 hours',
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
};

function MetricCard({ label, value, unavailable, tone, sparklineValues, sparklineColor, caption }) {
  return (
    <div className={`metric-card ${tone ? `metric-card--${tone}` : ''}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        {sparklineValues && <Sparkline values={sparklineValues} color={sparklineColor} />}
      </div>
      <div className="metric-card__value">
        {unavailable ? <span className="metric-card__na">—</span> : value}
      </div>
      {caption && <span className="metric-card__caption">{caption}</span>}
    </div>
  );
}

// Buckets can have a null field (e.g. no checks ran in that window) — walk
// backward to the most recent bucket that actually has a value.
function latestNonNull(series, field) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i][field];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function average(values) {
  const nums = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 100) / 100;
}

export function MetricCards({ summary, history, metrics, metricsError, range }) {
  const s = summary ?? {};
  const series = metrics?.series ?? [];
  const rangeLabel = RANGE_LABEL[range] ?? range;

  const isMetricsLoading = metrics === null && !metricsError;
  const metricsUnavailable = Boolean(metricsError);

  const uptimeSeries = series.map((bucket) => bucket.uptimePercent);
  const responseTimeSeries = series.map((bucket) => bucket.averageResponseTimeMs);
  const failedSeries = series.map((bucket) => bucket.failedChecks);
  const incidentSeries = series.map((bucket) => bucket.incidentCount);
  const totalServicesSeries = history.map((point) => point.totalServices);

  const uptimeValue = average(uptimeSeries);
  const responseTimeValue = latestNonNull(series, 'averageResponseTimeMs');

  const trendCaption = metricsUnavailable
    ? "couldn't load trend"
    : isMetricsLoading
      ? 'loading…'
      : rangeLabel;

  return (
    <div className="metric-cards">
      <MetricCard
        label="Uptime"
        value={uptimeValue === null ? '—' : `${uptimeValue}%`}
        unavailable={metricsUnavailable}
        sparklineValues={uptimeSeries}
        sparklineColor="var(--up)"
        caption={metricsUnavailable ? trendCaption : `avg · ${trendCaption}`}
      />
      <MetricCard
        label="Response Time"
        value={responseTimeValue === null ? '—' : `${Math.round(responseTimeValue)}ms`}
        unavailable={metricsUnavailable}
        sparklineValues={responseTimeSeries}
        sparklineColor="var(--accent)"
        caption={metricsUnavailable ? trendCaption : `latest · ${trendCaption}`}
      />
      <MetricCard
        label="Total Services"
        value={s.totalServices ?? 0}
        sparklineValues={totalServicesSeries}
        sparklineColor="var(--accent)"
        caption="this session"
      />
      <MetricCard
        label="Down Services"
        value={s.downServices ?? 0}
        tone={s.downServices > 0 ? 'down' : undefined}
        sparklineValues={failedSeries}
        sparklineColor="var(--down)"
        caption={metricsUnavailable ? trendCaption : `failed checks · ${trendCaption}`}
      />
      <MetricCard
        label="Open Incidents"
        value={s.openIncidents ?? 0}
        tone={s.openIncidents > 0 ? 'down' : undefined}
        sparklineValues={incidentSeries}
        sparklineColor="var(--amber)"
        caption={metricsUnavailable ? trendCaption : `new incidents · ${trendCaption}`}
      />
    </div>
  );
}
