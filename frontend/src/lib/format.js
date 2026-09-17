export function formatRelativeTime(isoString) {
  if (!isoString) return 'never';

  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}

export function formatDuration(ms) {
  if (ms < 1000) return `${Math.max(0, ms)}ms`;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && seconds) parts.push(`${seconds}s`);
  if (parts.length === 0) parts.push('0s');

  return parts.join(' ');
}

export function formatClockTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatHost(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

export function formatResponseTime(ms) {
  return ms === null || ms === undefined ? '—' : `${Math.round(ms)}ms`;
}

export function formatUptime(percent) {
  return percent === null || percent === undefined ? '—' : `${percent}%`;
}
