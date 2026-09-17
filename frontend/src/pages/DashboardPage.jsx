import { useState } from 'react';
import { getDashboardMetrics, getDashboardSummary } from '../api/dashboard.js';
import { listIncidents } from '../api/incidents.js';
import { checkServiceNow, deleteService, listServices, updateService } from '../api/services.js';
import { AddServicePanel } from '../components/AddServicePanel.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { EditServicePanel } from '../components/EditServicePanel.jsx';
import { IncidentTimeline } from '../components/IncidentTimeline.jsx';
import { MetricCards } from '../components/MetricCards.jsx';
import { ServicesTable } from '../components/ServicesTable.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { Toast } from '../components/Toast.jsx';
import { TopHeader } from '../components/TopHeader.jsx';
import { useMetricHistory } from '../hooks/useMetricHistory.js';
import { usePolling } from '../hooks/usePolling.js';
import { useTheme } from '../hooks/useTheme.js';
import { useToast } from '../hooks/useToast.js';
import { ServiceDetailPage } from './ServiceDetailPage.jsx';

const POLL_INTERVAL_MS = 15000;

export function DashboardPage() {
  const [activeView, setActiveView] = useState('overview');
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const { theme, setTheme } = useTheme();

  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [deletingService, setDeletingService] = useState(null);
  const [pendingServiceId, setPendingServiceId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const { toast, showToast, dismissToast } = useToast();

  const summaryPoll = usePolling(getDashboardSummary, { intervalMs: POLL_INTERVAL_MS });
  const servicesPoll = usePolling(() => listServices(timeRange), {
    intervalMs: POLL_INTERVAL_MS,
    key: timeRange,
  });
  const incidentsPoll = usePolling(() => listIncidents(), { intervalMs: POLL_INTERVAL_MS });
  const metricsPoll = usePolling(() => getDashboardMetrics(timeRange), {
    intervalMs: POLL_INTERVAL_MS,
    key: timeRange,
  });
  const metricHistory = useMetricHistory(summaryPoll.data, summaryPoll.lastUpdatedAt);

  const hasError = Boolean(
    summaryPoll.error || servicesPoll.error || incidentsPoll.error || metricsPoll.error,
  );
  const openIncidents = (incidentsPoll.data ?? []).filter((incident) => incident.status === 'open');

  function refreshAll() {
    summaryPoll.refresh();
    servicesPoll.refresh();
    incidentsPoll.refresh();
    metricsPoll.refresh();
  }

  function handleServiceSaved() {
    showToast('Service updated.', 'success');
    refreshAll();
  }

  async function handleToggleActive(service) {
    setPendingServiceId(service.id);
    try {
      await updateService(service.id, { is_active: !service.isActive });
      showToast(`${service.name} ${service.isActive ? 'paused' : 'resumed'}.`, 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPendingServiceId(null);
    }
  }

  function handleDeleteRequest(service) {
    setDeleteError(null);
    setDeletingService(service);
  }

  async function handleDeleteConfirm() {
    if (!deletingService) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteService(deletingService.id);
      showToast(`${deletingService.name} deleted.`, 'success');
      if (selectedServiceId === deletingService.id) {
        setSelectedServiceId(null);
      }
      setDeletingService(null);
      refreshAll();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCheckNow(service) {
    setPendingServiceId(service.id);
    try {
      await checkServiceNow(service.id);
      showToast(`${service.name} checked.`, 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPendingServiceId(null);
    }
  }

  const serviceTableActions = {
    onEdit: setEditingService,
    onToggleActive: handleToggleActive,
    onDelete: handleDeleteRequest,
    onOpenDetail: (service) => setSelectedServiceId(service.id),
    pendingServiceId,
  };

  function handleNavigate(view) {
    setSelectedServiceId(null);
    setActiveView(view);
  }

  return (
    <div className="shell">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} />

      <div className="shell__main">
        <TopHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          openIncidents={openIncidents}
          onAddService={() => setIsAddPanelOpen(true)}
          theme={theme}
          onThemeChange={setTheme}
        />

        <main className="shell__content">
          {hasError && (
            <p className="banner banner--error">Unable to reach the API. Retrying automatically…</p>
          )}

          {selectedServiceId ? (
            <ServiceDetailPage
              serviceId={selectedServiceId}
              range={timeRange}
              onBack={() => setSelectedServiceId(null)}
              onEdit={setEditingService}
              onToggleActive={handleToggleActive}
              onDelete={handleDeleteRequest}
              onCheckNow={handleCheckNow}
              pendingServiceId={pendingServiceId}
            />
          ) : (
            <>
              {activeView === 'overview' && (
                <>
                  <MetricCards
                    summary={summaryPoll.data}
                    history={metricHistory}
                    metrics={metricsPoll.data}
                    metricsError={metricsPoll.error}
                    range={timeRange}
                  />
                  <div className="overview-grid">
                    <ServicesTable
                      services={servicesPoll.data}
                      searchQuery={searchQuery}
                      {...serviceTableActions}
                    />
                    <IncidentTimeline
                      incidents={incidentsPoll.data}
                      now={incidentsPoll.lastUpdatedAt}
                      timeRange={timeRange}
                    />
                  </div>
                </>
              )}

              {(activeView === 'services' || activeView === 'monitors') && (
                <ServicesTable
                  services={servicesPoll.data}
                  searchQuery={searchQuery}
                  title={activeView === 'monitors' ? 'Monitors' : 'All Services'}
                  {...serviceTableActions}
                />
              )}

              {activeView === 'incidents' && (
                <IncidentTimeline
                  incidents={incidentsPoll.data}
                  now={incidentsPoll.lastUpdatedAt}
                  timeRange={timeRange}
                  title="All Incidents"
                />
              )}

              {activeView === 'analytics' && (
                <>
                  <p className="panel__subtitle panel__subtitle--standalone">
                    Uptime, response time, failed-check, and incident trends use real bucketed history
                    from the API for the selected range above. Total Services has no historical endpoint
                    yet, so its trend is only this session's polling.
                  </p>
                  <MetricCards
                    summary={summaryPoll.data}
                    history={metricHistory}
                    metrics={metricsPoll.data}
                    metricsError={metricsPoll.error}
                    range={timeRange}
                  />
                </>
              )}

              {activeView === 'settings' && (
                <section className="panel settings-placeholder" aria-label="Settings">
                  <header className="panel__header">
                    <h2>Settings</h2>
                  </header>
                  <p className="empty-state">
                    There's no settings API yet, so this is a placeholder rather than a form that
                    doesn't save anything.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <AddServicePanel isOpen={isAddPanelOpen} onClose={() => setIsAddPanelOpen(false)} onCreated={refreshAll} />

      <EditServicePanel service={editingService} onClose={() => setEditingService(null)} onSaved={handleServiceSaved} />

      <ConfirmDialog
        isOpen={Boolean(deletingService)}
        title="Delete service"
        message={
          deletingService
            ? `Delete "${deletingService.name}"? This removes its health check history and incidents too. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        isSubmitting={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingService(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
