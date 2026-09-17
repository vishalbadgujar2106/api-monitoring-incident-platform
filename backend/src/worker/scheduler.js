import cron from 'node-cron';
import { findDueServices } from '../modules/services/services.repository.js';
import { recordHealthCheck } from './recordHealthCheck.js';

const TICK_CRON_EXPRESSION = '*/10 * * * * *'; // every 10 seconds (6-field: seconds first)

let task = null;

// Guards against a service being checked by two overlapping ticks: a slow
// check can still be in flight when the next tick fires, and last_checked_at
// isn't updated in the DB until the check completes, so the due-query alone
// isn't enough to prevent that overlap.
const inFlightServiceIds = new Set();

async function checkService(service) {
  if (inFlightServiceIds.has(service.id)) {
    return;
  }
  inFlightServiceIds.add(service.id);

  try {
    await recordHealthCheck(service);
  } catch (err) {
    // One service's failure (bad DB write, unexpected error) must never
    // stop the rest of the tick or crash the scheduler.
    console.error(`[scheduler] health check failed for service ${service.id} (${service.name}):`, err.message);
  } finally {
    inFlightServiceIds.delete(service.id);
  }
}

async function tick() {
  let dueServices;
  try {
    dueServices = await findDueServices();
  } catch (err) {
    console.error('[scheduler] failed to load due services:', err.message);
    return;
  }

  await Promise.allSettled(dueServices.map((service) => checkService(service)));
}

export function startScheduler() {
  if (task) {
    return task;
  }
  task = cron.schedule(TICK_CRON_EXPRESSION, tick);
  return task;
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}
