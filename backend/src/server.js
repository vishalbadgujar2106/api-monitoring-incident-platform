import 'dotenv/config';

// Checked before importing app.js/config/db.js so a missing var fails with
// one clear line instead of an uncaught-exception stack trace from deep
// inside the pg pool constructor.
const REQUIRED_ENV_VARS = ['DATABASE_URL'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `Cannot start: missing required environment variable(s): ${missingEnvVars.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and configure them.',
  );
  process.exit(1);
}

const { default: app } = await import('./app.js');
const { default: pool } = await import('./config/db.js');
const { startScheduler, stopScheduler } = await import('./worker/scheduler.js');

const port = process.env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
  startScheduler();
  console.log('Health-check scheduler started');
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received, shutting down gracefully...`);
  stopScheduler();

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
