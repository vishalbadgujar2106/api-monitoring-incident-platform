CREATE INDEX idx_health_checks_service_time ON health_checks (service_id, checked_at DESC);
CREATE INDEX idx_incidents_service_status ON incidents (service_id, status);
CREATE INDEX idx_incidents_open ON incidents (status) WHERE status = 'open';
