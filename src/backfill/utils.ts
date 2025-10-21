/**
 * Backfill utility functions
 */
import { BACKFILL_CONFIG } from "./config";

export function calculateBackoffDelay(attempt: number, baseDelay = BACKFILL_CONFIG.RETRY_DELAY_MS): number {
  return baseDelay * Math.pow(BACKFILL_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
}

export function shouldTriggerGC(): boolean {
  const usage = process.memoryUsage();
  const heapMB = usage.heapUsed / 1024 / 1024;
  return heapMB > BACKFILL_CONFIG.GC_THRESHOLD_MB;
}

export function formatProgress(current: number, total: number, startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime();
  const rate = current / (elapsed / 1000);
  const eta = total > current ? (total - current) / rate : 0;
  
  return `${current}/${total} (${((current/total)*100).toFixed(1)}%) - ${rate.toFixed(1)}/s - ETA: ${Math.round(eta)}s`;
}

export function parseRateLimitHeaders(headers: Record<string, string>): {
  remaining: number;
  reset: number;
  limit: number;
} {
  return {
    remaining: parseInt(headers["ratelimit-remaining"] ?? "0", 10),
    reset: parseInt(headers["ratelimit-reset"] ?? "0", 10),
    limit: parseInt(headers["ratelimit-limit"] ?? "0", 10),
  };
}

export function createCheckpoint(data: unknown): void {
  try {
    const fs = require("fs");
    fs.writeFileSync("backfill-checkpoint.json", JSON.stringify(data, null, 2));
  } catch (_err) {
    console.warn("Failed to save checkpoint");
  }
}

export function loadCheckpoint<T>(): T | null {
  try {
    const fs = require("fs");
    return JSON.parse(fs.readFileSync("backfill-checkpoint.json", "utf8"));
  } catch (_err) {
    return null;
  }
}
