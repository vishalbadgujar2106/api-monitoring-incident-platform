CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,
    method          VARCHAR(10) NOT NULL DEFAULT 'GET',
    expected_status INTEGER NOT NULL DEFAULT 200,
    check_interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_ms      INTEGER NOT NULL DEFAULT 5000,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    current_status  VARCHAR(10) NOT NULL DEFAULT 'unknown',
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
