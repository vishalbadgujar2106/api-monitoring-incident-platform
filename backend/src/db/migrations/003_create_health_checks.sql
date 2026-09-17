CREATE TABLE health_checks (
    id              BIGSERIAL PRIMARY KEY,
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status          VARCHAR(10) NOT NULL,
    status_code     INTEGER,
    response_time_ms INTEGER,
    error_message   TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
