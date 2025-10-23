
import { flushAll, queues } from './queue-manager';

// Read from env directly to avoid coupling to project Config loader
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '50000', 10);
const MEMORY_SOFT_LIMIT_MB = parseInt(process.env.MEMORY_SOFT_LIMIT_MB || '1200', 10);
const MEMORY_HARD_LIMIT_MB = parseInt(process.env.MEMORY_HARD_LIMIT_MB || '1500', 10);
const MEMORY_CHECK_INTERVAL_MS = parseInt(process.env.MEMORY_CHECK_INTERVAL_MS || '5000', 10);
const INGEST_PAUSE_MS = parseInt(process.env.INGEST_PAUSE_MS || '3000', 10);

let paused = false;
let lastLog = 0;

export function isIngestPaused() {
  return paused;
}

function memMB() {
  const rss = process.memoryUsage().rss; // resident set size
  return Math.round(rss / 1048576); // to MB
}

function totalQueueSize(): number {
  return Object.values(queues).reduce((sum, q) => sum + q.length, 0);
}

export function shouldDropEvent(): boolean {
  if (paused) return true;
  const size = totalQueueSize();
  return size >= MAX_QUEUE_SIZE;
}

function maybeLog(msg: string) {
  const now = Date.now();
  if (now - lastLog > 5000) {
    console.warn(msg);
    lastLog = now;
  }
}

async function applyBackpressure(reason: string) {
  if (!paused) {
    paused = true;
    maybeLog(`[resource-monitor] Pausing ingestion: ${reason}`);
  }
  // Optional: try to help GC if available
  try { (global as any).gc?.(); } catch {}
  // Let queues flush
  await flushAll();
}

function releaseBackpressure() {
  if (paused) {
    paused = false;
    console.warn('[resource-monitor] Resuming ingestion');
  }
}

export function startResourceMonitor() {
  setInterval(async () => {
    const mb = memMB();
    if (mb >= MEMORY_HARD_LIMIT_MB) {
      await applyBackpressure(`memory ${mb}MB >= HARD ${MEMORY_HARD_LIMIT_MB}MB`);
      setTimeout(releaseBackpressure, INGEST_PAUSE_MS * 2);
      return;
    }
    if (mb >= MEMORY_SOFT_LIMIT_MB) {
      await applyBackpressure(`memory ${mb}MB >= SOFT ${MEMORY_SOFT_LIMIT_MB}MB`);
      setTimeout(releaseBackpressure, INGEST_PAUSE_MS);
      return;
    }

    // Backpressure on queue size alone
    const size = totalQueueSize();
    if (size >= MAX_QUEUE_SIZE) {
      await applyBackpressure(`queues=${size} >= cap ${MAX_QUEUE_SIZE}`);
      setTimeout(releaseBackpressure, INGEST_PAUSE_MS);
      return;
    }
  }, MEMORY_CHECK_INTERVAL_MS);
}
