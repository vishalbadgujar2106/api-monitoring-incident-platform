import { useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside.js';
import { formatHost, formatRelativeTime, formatResponseTime, formatUptime } from '../lib/format.js';
import { StatusDot } from './StatusDot.jsx';

const MENU_WIDTH = 160;

function ServiceActionsMenu({ service, isOpen, onToggle, onClose, onEdit, onToggleActive, onDelete, isBusy }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useClickOutside([triggerRef, menuRef], onClose, isOpen);

  function handleTriggerClick() {
    if (!isOpen) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.right - MENU_WIDTH });
    }
    onToggle();
  }

  function runAction(action) {
    onClose();
    action(service);
  }

  return (
    <div className="action-menu">
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn action-menu__trigger"
        onClick={handleTriggerClick}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions for ${service.name}`}
        disabled={isBusy}
      >
        {isBusy ? '…' : '⋮'}
      </button>

      {isOpen && coords && (
        <div
          ref={menuRef}
          className="action-menu__panel"
          style={{ top: coords.top, left: coords.left }}
          role="menu"
        >
          <button type="button" role="menuitem" onClick={() => runAction(onEdit)}>
            Edit
          </button>
          <button type="button" role="menuitem" onClick={() => runAction(onToggleActive)}>
            {service.isActive ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="action-menu__item--danger"
            onClick={() => runAction(onDelete)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function ServicesTable({
  services,
  searchQuery,
  title = 'Services',
  onEdit,
  onToggleActive,
  onDelete,
  onOpenDetail,
  pendingServiceId,
}) {
  const list = services ?? [];
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? list.filter(
        (service) =>
          service.name.toLowerCase().includes(query) || service.url.toLowerCase().includes(query),
      )
    : list;

  const [openMenuId, setOpenMenuId] = useState(null);
  const showActions = Boolean(onEdit && onToggleActive && onDelete);

  return (
    <section className="panel services-table" aria-label={title}>
      <header className="panel__header">
        <h2>{title}</h2>
        <span className="panel__count">{filtered.length}</span>
      </header>

      {services === null ? (
        <p className="empty-state">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">
          {query ? `No services match "${searchQuery}".` : 'No services being monitored yet.'}
        </p>
      ) : (
        <div className="services-table__scroll">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Uptime</th>
                <th>Last Checked</th>
                <th>State</th>
                {showActions && <th aria-hidden="true" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((service) => (
                <tr key={service.id}>
                  <td>
                    {onOpenDetail ? (
                      <button
                        type="button"
                        className="services-table__id services-table__id--link"
                        onClick={() => onOpenDetail(service)}
                      >
                        <span className="services-table__name">{service.name}</span>
                        <span className="services-table__url">{formatHost(service.url)}</span>
                      </button>
                    ) : (
                      <div className="services-table__id">
                        <span className="services-table__name">{service.name}</span>
                        <span className="services-table__url">{formatHost(service.url)}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="status-label">
                      <StatusDot status={service.currentStatus} />
                      {service.currentStatus}
                    </span>
                  </td>
                  <td className="services-table__mono">{formatResponseTime(service.lastResponseTimeMs)}</td>
                  <td className="services-table__mono">{formatUptime(service.uptimePercent)}</td>
                  <td className="services-table__mono">{formatRelativeTime(service.lastCheckedAt)}</td>
                  <td>
                    <span className={`chip ${service.isActive ? 'chip--active' : 'chip--paused'}`}>
                      {service.isActive ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </td>
                  {showActions && (
                    <td className="services-table__actions">
                      <ServiceActionsMenu
                        service={service}
                        isOpen={openMenuId === service.id}
                        onToggle={() => setOpenMenuId((id) => (id === service.id ? null : service.id))}
                        onClose={() => setOpenMenuId(null)}
                        onEdit={onEdit}
                        onToggleActive={onToggleActive}
                        onDelete={onDelete}
                        isBusy={pendingServiceId === service.id}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
