/**
 * Configuration manager that validates everything at startup
 * 
 * BEFORE: Scattered process.env everywhere, production crashes from missing vars
 * AFTER: Clear errors, validated config, type safety
 */

export interface AppConfig {
  database: {
    url: string;
    poolMax: number;
    poolMin: number;
  };
  jetstream: {
    endpoint: string;
    collection: string;
  };
  atproto: {
    service: string;
    rateLimitPerSecond: number;
  };
  supabase: {
    url: string;
    serviceKey: string;
  };
  server: {
    port: number;
    environment: "development" | "production" | "test";
  };
  features: {
    enableDebugLogs: boolean;
    enableCircuitBreaker: boolean;
    enableRateLimit: boolean;
  };
}

class ConfigManager {
  private config: AppConfig | null = null;

  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    // Validate all required environment variables
    const requiredEnvVars = {
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Check for missing required vars
    const missing = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    this.config = {
      database: {
        url: requiredEnvVars.DATABASE_URL!,
        poolMax: parseInt(process.env.DB_POOL_MAX || "10"),
        poolMin: parseInt(process.env.DB_POOL_MIN || "2"),
      },
      jetstream: {
        endpoint: process.env.JETSTREAM_ENDPOINT || "wss://jetstream2.us-east.bsky.network/subscribe",
        collection: process.env.JETSTREAM_COLLECTION || "app.bsky.feed.post",
      },
      atproto: {
        service: process.env.ATPROTO_SERVICE || "https://public.api.bsky.app",
        rateLimitPerSecond: parseInt(process.env.ATPROTO_RATE_LIMIT || "10"),
      },
      supabase: {
        url: requiredEnvVars.SUPABASE_URL!,
        serviceKey: requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY!,
      },
      server: {
        port: parseInt(process.env.PORT || "3000"),
        environment: (process.env.NODE_ENV as any) || "development",
      },
      features: {
        enableDebugLogs: process.env.DEBUG === "true",
        enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== "false", // enabled by default
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== "false", // enabled by default
      },
    };

    return this.config;
  }

  get(): AppConfig {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.config;
  }

  isDevelopment(): boolean {
    return this.get().server.environment === "development";
  }

  isProduction(): boolean {
    return this.get().server.environment === "production";
  }

  isTest(): boolean {
    return this.get().server.environment === "test";
  }
}

// Singleton instance
export const config = new ConfigManager();
