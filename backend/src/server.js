import 'dotenv/config';
import app from './app.js';
import pool from './config/db.js';
import { startScheduler, stopScheduler } from './worker/scheduler.js';

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
