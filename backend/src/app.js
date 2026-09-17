import express from 'express';
import cors from 'cors';
import servicesRouter from './modules/services/services.routes.js';
import incidentsRouter from './modules/incidents/incidents.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import pool from './config/db.js';

const app = express();

// The Vite dev server's default origin is always allowed, in addition to
// whatever the deployed frontend's origin is (set via FRONTEND_ORIGIN) —
// there is no wildcard fallback, so a misconfigured deployment fails
// closed (blocked requests) rather than open (any origin allowed).
const DEV_ORIGIN = 'http://localhost:5173';
const allowedOrigins = [DEV_ORIGIN, process.env.FRONTEND_ORIGIN].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header means a non-browser request (curl, a health
      // check, server-to-server) — those aren't subject to CORS anyway.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new AppError(`Origin ${origin} is not allowed by CORS`, 403, 'CORS_ORIGIN_DENIED'));
      }
    },
  }),
);
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable', reason: 'database unreachable' });
  }
});

app.use('/api/services', servicesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(errorHandler);

export default app;
