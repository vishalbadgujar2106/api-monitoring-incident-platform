import express from 'express';
import cors from 'cors';
import servicesRouter from './modules/services/services.routes.js';
import incidentsRouter from './modules/incidents/incidents.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/services', servicesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(errorHandler);

export default app;
