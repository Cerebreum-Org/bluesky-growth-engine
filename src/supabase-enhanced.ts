/**
 * Production-grade Supabase client with reliability patterns
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Result } from "./shared/Result";
import { Ok, Err } from "./shared/Result";
import { Logger } from "./shared/Logger";
import { CircuitBreaker } from "./shared/CircuitBreaker";
import { config } from "./shared/Config";

const logger = Logger.create("SupabaseClient");
const appConfig = config.get();

// Circuit breakers for different operation types
const queryBreaker = new CircuitBreaker("supabase-query", {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitorTimeout: 5000
});

const bulkBreaker = new CircuitBreaker("supabase-bulk", {
  failureThreshold: 3,
  recoveryTimeout: 20000,
  monitorTimeout: 10000
});

// Performance monitoring
interface QueryMetrics {
  operation: string;
  table: string;
  duration: number;
  rowCount?: number;
  success: boolean;
  timestamp: Date;
}

class SupabaseMetrics {
  private static metrics: QueryMetrics[] = [];
  private static readonly MAX_METRICS = 1000;

  static record(metric: QueryMetrics) {
    this.metrics.push(metric);
    
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow queries
    if (metric.duration > 1000) {
      logger.warn("Slow query detected", {
        operation: metric.operation,
        table: metric.table,
        duration: metric.duration,
        row_count: metric.rowCount
      });
    }
  }

  static getStats() {
    const totalQueries = this.metrics.length;
    const avgDuration = totalQueries > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;
    const slowQueries = this.metrics.filter(m => m.duration > 1000).length;
    const errors = this.metrics.filter(m => !m.success).length;
    const errorRate = totalQueries > 0 ? errors / totalQueries : 0;

    return { totalQueries, avgDuration, slowQueries, errorRate };
  }
}

/**
 * Enhanced Supabase client wrapper
 */
export class EnhancedSupabaseClient {
  private client: SupabaseClient;
  private bulkClient: SupabaseClient;

  constructor() {
    if (!appConfig.supabase.url || !appConfig.supabase.serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    this.client = createClient(appConfig.supabase.url, appConfig.supabase.serviceKey, {
      db: { schema: "public" },
      auth: { persistSession: false },
      global: {
        headers: {
          "x-client-info": "bluesky-growth-engine",
          "x-client-version": "enhanced"
        }
      }
    });

    this.bulkClient = createClient(appConfig.supabase.url, appConfig.supabase.serviceKey, {
      db: { schema: "public" },
      auth: { persistSession: false },
      global: {
        headers: {
          "x-client-info": "bluesky-growth-engine-bulk",
          "x-client-version": "enhanced"
        }
      }
    });

    logger.info("Enhanced Supabase client initialized");
  }

  async executeQuery<T>(
    operation: string,
    table: string,
    queryFn: (client: SupabaseClient) => Promise<any>,
    useBulkClient = false
  ): Promise<Result<T, string | Error>> {
    const startTime = Date.now();
    const client = useBulkClient ? this.bulkClient : this.client;
    const breaker = useBulkClient ? bulkBreaker : queryBreaker;

    return breaker.execute(async () => {
      try {
        const response = await queryFn(client);
        const duration = Date.now() - startTime;

        if (response.error) {
          SupabaseMetrics.record({
            operation, table, duration, rowCount: 0, success: false, timestamp: new Date()
          });

          logger.error("Supabase query failed", {
            operation, table, error: response.error.message, duration
          });

          throw new Error(`Supabase error: ${response.error.message}`);
        }

        const rowCount = Array.isArray(response.data) ? response.data.length : 1;
        SupabaseMetrics.record({
          operation, table, duration, rowCount, success: true, timestamp: new Date()
        });

        logger.debug("Supabase query completed", { operation, table, duration, row_count: rowCount });
        return response.data;

      } catch (error) {
        const duration = Date.now() - startTime;
        SupabaseMetrics.record({
          operation, table, duration, success: false, timestamp: new Date()
        });

        const errorMessage = error instanceof Error ? error.message : "Unknown database error";
        logger.error("Database operation failed", { operation, table, error: errorMessage, duration });
        throw new Error(errorMessage);
      }
    });
  }

  async select<T>(table: string, options?: {
    columns?: string; filter?: Record<string, any>; orderBy?: string; limit?: number;
  }): Promise<Result<T[], string | Error>> {
    return this.executeQuery("select", table, async (client) => {
      let query: any = client.from(table);

      if (options?.columns) {
        query = query.select(options.columns);
      } else {
        query = query.select("*");
      }

      if (options?.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
          query = query.eq(key, value);
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      return query;
    });
  }

  async upsert<T>(table: string, data: T | T[], options?: { onConflict?: string }): Promise<Result<T[], string | Error>> {
    const isArray = Array.isArray(data);
    const recordCount = isArray ? data.length : 1;
    const useBulkClient = recordCount > 10;

    return this.executeQuery("upsert", table, async (client) => {
      let query = client.from(table).upsert(data) as any;
      if (options?.onConflict) {
        query = query.onConflict(options.onConflict);
      }
      return query.select();
    }, useBulkClient);
  }

  getStats() {
    const metrics = SupabaseMetrics.getStats();
    return {
      ...metrics,
      circuit_breakers: {
        query: queryBreaker.getStats(),
        bulk: bulkBreaker.getStats()
      }
    };
  }

  async healthCheck(): Promise<Result<{ status: string; responseTime: number }, string>> {
    const startTime = Date.now();
    try {
      const result = await this.client.from("bluesky_users").select("did").limit(1);
      const responseTime = Date.now() - startTime;

      if (result.error) {
        return Err(`Health check failed: ${result.error.message}`);
      }

      return Ok({ status: "healthy", responseTime });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Health check failed";
      return Err(errorMessage);
    }
  }
}

// Create and export enhanced client instance
export const enhancedSupabase = new EnhancedSupabaseClient();

// Export for backward compatibility
export const supabase = enhancedSupabase;

// Type exports
export interface BlueskyUser {
  did: string;
  handle: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  labels?: unknown;
  associated?: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author_did: string;
  text?: string;
  created_at: string;
  like_count?: number;
  repost_count?: number;
  reply_count?: number;
  updated_at?: string;
}
