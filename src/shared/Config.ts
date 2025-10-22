/**
 * Configuration Manager with Validation
 * 
 * Validates all required environment variables at startup to fail fast
 * rather than crashing in production hours later.
 * 
 * Features:
 * - Type-safe configuration
 * - Required vs optional environment variables
 * - Validation with helpful error messages
 * - Result type for load operation
 * - Environment detection helpers
 * 
 * @example
 * ```typescript
 * import { config } from './shared/Config.js';
 * 
 * const result = config.load();
 * if (!result.ok) {
 *   console.error("Config error:", result.error);
 *   process.exit(1);
 * }
 * 
 * const cfg = config.get();
 * console.log("Port:", cfg.server.port);
 * ```
 */

import { Result, Ok, Err, ErrResult } from "./Result.js";
import { Logger } from "./Logger.js";

const logger = Logger.create("Config");

export interface AppConfig {
  // Bluesky/ATProto
  bluesky: {
    handle: string;
    password: string;
    service: string;
  };
  
  // Database
  database: {
    url: string;
    poolMax: number;
    poolMin: number;
  };
  
  // Supabase
  supabase: {
    url: string;
    serviceKey: string;
    anonKey?: string;  // For frontend
  };
  
  // Jetstream (real-time firehose)
  jetstream: {
    endpoint: string;
    collections: string[];
    wantedDids?: string[];
  };
  
  // AT Protocol API
  atproto: {
    service: string;
    rateLimitPerSecond: number;
  };
  
  // Server
  server: {
    port: number;
    host: string;
    environment: "development" | "production" | "test";
  };
  
  // API Server
  api: {
    host: string;
    port: number;
  };
  
  // Features
  features: {
    enableDebugLogs: boolean;
    enableCircuitBreaker: boolean;
    enableRateLimit: boolean;
  };
  
  // Tuning
  tuning: {
    batchSize: number;
    rateLimitDelayMs: number;
    concurrency: number;
  };
}

interface EnvVarConfig {
  required: string[];
  optional: string[];
}

class ConfigManager {
  private config: AppConfig | null = null;

  /**
   * Load and validate configuration from environment
   */
  load(): Result<AppConfig, string> {
    if (this.config) {
      return Ok(this.config);
    }

    logger.info("Loading configuration from environment");

    // Define required environment variables
    const requiredVars = [
      "SUPABASE_URL",
      "SUPABASE_KEY",  // Can be service role or anon depending on context
    ];

    // Optional but commonly used
    const optionalVars = [
      "BLUESKY_HANDLE",
      "BLUESKY_PASSWORD",
      "BLUESKY_SERVICE",
      "DATABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ANON_KEY",
      "PORT",
      "API_HOST",
      "API_PORT",
      "NODE_ENV",
      "LOG_LEVEL",
      "JETSTREAM_ENDPOINT",
      "JETSTREAM_COLLECTIONS",
      "JETSTREAM_WANTED_DIDS",
      "BATCH_SIZE",
      "RATE_LIMIT_DELAY_MS",
      "CONCURRENCY",
    ];

    // Check for missing required vars
    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please set these in your .env file or environment.`;
      logger.error("Configuration validation failed", { missing_vars: missing });
      return Err(error);
    }

    // Parse collections (comma-separated)
    const collectionsStr = process.env.JETSTREAM_COLLECTIONS || "app.bsky.feed.post,app.bsky.feed.like,app.bsky.graph.follow";
    const collections = collectionsStr.split(",").map(s => s.trim());

    // Parse wanted DIDs if provided
    const wantedDidsStr = process.env.JETSTREAM_WANTED_DIDS;
    const wantedDids = wantedDidsStr ? wantedDidsStr.split(",").map(s => s.trim()) : undefined;

    // Build config object
    this.config = {
      bluesky: {
        handle: process.env.BLUESKY_HANDLE || "",
        password: process.env.BLUESKY_PASSWORD || "",
        service: process.env.BLUESKY_SERVICE || "https://bsky.social",
      },
      database: {
        url: process.env.DATABASE_URL || process.env.SUPABASE_URL!,
        poolMax: this.parseInt(process.env.DB_POOL_MAX, 10),
        poolMin: this.parseInt(process.env.DB_POOL_MIN, 2),
      },
      supabase: {
        url: process.env.SUPABASE_URL!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!,
        anonKey: process.env.SUPABASE_ANON_KEY,
      },
      jetstream: {
        endpoint: process.env.JETSTREAM_ENDPOINT || "wss://jetstream2.us-east.bsky.network/subscribe",
        collections,
        wantedDids,
      },
      atproto: {
        service: process.env.ATPROTO_SERVICE || "https://public.api.bsky.app",
        rateLimitPerSecond: this.parseInt(process.env.ATPROTO_RATE_LIMIT, 10),
      },
      server: {
        port: this.parseInt(process.env.PORT, 3000),
        host: process.env.HOST || "0.0.0.0",
        environment: this.parseEnvironment(process.env.NODE_ENV),
      },
      api: {
        host: process.env.API_HOST || "localhost",
        port: this.parseInt(process.env.API_PORT, 3001),
      },
      features: {
        enableDebugLogs: process.env.DEBUG === "true" || process.env.LOG_LEVEL === "DEBUG",
        enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== "false", // enabled by default
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== "false", // enabled by default
      },
      tuning: {
        batchSize: this.parseInt(process.env.BATCH_SIZE, 100),
        rateLimitDelayMs: this.parseInt(process.env.RATE_LIMIT_DELAY_MS, 1000),
        concurrency: this.parseInt(process.env.CONCURRENCY, 5),
      },
    };

    logger.info("Configuration loaded successfully", {
      environment: this.config.server.environment,
      port: this.config.server.port,
      collections: this.config.jetstream.collections,
      features: this.config.features,
    });

    return Ok(this.config);
  }

  /**
   * Get loaded configuration (throws if not loaded)
   */
  get(): AppConfig {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.config;
  }

  /**
   * Get configuration with Result type (doesn't throw)
   */
  tryGet(): Result<AppConfig, string> {
    if (!this.config) {
      return Err("Config not loaded. Call load() first.");
    }
    return Ok(this.config);
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.get().server.environment === "development";
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.get().server.environment === "production";
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.get().server.environment === "test";
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return this.get().server.environment;
  }

  /**
   * Validate that Bluesky credentials are configured
   */
  hasBlueskyCredentials(): boolean {
    const cfg = this.get();
    return !!(cfg.bluesky.handle && cfg.bluesky.password);
  }

  /**
   * Get printable summary (without secrets)
   */
  getSummary(): string {
    const cfg = this.get();
    return `
Configuration Summary:
  Environment: ${cfg.server.environment}
  Server: ${cfg.server.host}:${cfg.server.port}
  API: ${cfg.api.host}:${cfg.api.port}
  Database: ${cfg.database.url.replace(/\/\/.*@/, "//***@")}
  Supabase: ${cfg.supabase.url}
  Bluesky Service: ${cfg.bluesky.service}
  Bluesky Handle: ${cfg.bluesky.handle || "(not configured)"}
  Jetstream: ${cfg.jetstream.endpoint}
  Collections: ${cfg.jetstream.collections.join(", ")}
  Features: ${Object.entries(cfg.features).filter(([k, v]) => v).map(([k]) => k).join(", ")}
    `.trim();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private parseInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseEnvironment(env: string | undefined): "development" | "production" | "test" {
    if (env === "production" || env === "test") {
      return env;
    }
    return "development";
  }
}


// Singleton instance
export const config = new ConfigManager();

// Auto-load config if not in test environment
if (process.env.NODE_ENV !== "test") {
  const result = config.load();
  if (!result.ok) {
    const errorResult = result as ErrResult<string>;
    console.error("Fatal: Failed to load configuration");
    console.error(errorResult.error);
    process.exit(1);
  }
}
