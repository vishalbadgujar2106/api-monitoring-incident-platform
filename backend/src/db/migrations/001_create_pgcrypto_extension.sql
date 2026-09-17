-- Needed for gen_random_uuid() on PostgreSQL versions before it was built into core (< 13).
-- Safe/idempotent to run on newer versions too.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
