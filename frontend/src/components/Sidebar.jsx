const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: '◧' },
  { key: 'services', label: 'Services', icon: '▤' },
  { key: 'incidents', label: 'Incidents', icon: '⚑' },
  { key: 'monitors', label: 'Monitors', icon: '◎' },
  { key: 'analytics', label: 'Analytics', icon: '▲' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ activeView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true">◈</span>
        <span className="sidebar__title">BeaconOps</span>
      </div>

      <nav className="sidebar__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar__link ${activeView === item.key ? 'sidebar__link--active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-current={activeView === item.key ? 'page' : undefined}
          >
            <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <span className="sidebar__footer-label">Monitoring Console</span>
        <span className="sidebar__footer-meta">v1 · self-hosted</span>
      </div>
    </aside>
  );
}
