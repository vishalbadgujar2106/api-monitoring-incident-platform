import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.');
}

// Most hosted Postgres providers (RDS, Render, Supabase, etc.) require TLS
// and present a certificate not in Node's default trust store — opt in
// explicitly via DATABASE_SSL rather than guessing from NODE_ENV, since
// some production setups (self-hosted, VPN-only) don't need it.
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({ connectionString, ssl });

export default pool;
