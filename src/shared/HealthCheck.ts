/**
 * Simple health check system
 */

import { config } from "./Config";
import { Logger } from "./Logger";

const logger = Logger.create("HealthCheck");

export interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  responseTime?: number;
  timestamp: string;
}

export interface SystemHealth {
  overall: "healthy" | "unhealthy" | "degraded";
  services: HealthStatus[];
  timestamp: string;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthStatus>> = new Map();

  registerCheck(name: string, checkFn: () => Promise<HealthStatus>) {
    this.checks.set(name, checkFn);
  }

  async checkAll(): Promise<SystemHealth> {
    const services: HealthStatus[] = [];
    
    // Convert Map to Array to avoid iteration issues
    const checkEntries = Array.from(this.checks.entries());
    
    for (const [name, checkFn] of checkEntries) {
      try {
        const result = await Promise.race([
          checkFn(),
          // Timeout after 5 seconds
          new Promise<HealthStatus>((_, reject) => 
            setTimeout(() => reject(new Error("Health check timeout")), 5000)
          )
        ]);
        services.push(result);
      } catch (error) {
        logger.error(`Health check failed for ${name}`, { error: error instanceof Error ? error.message : error });
        services.push({
          service: name,
          status: "unhealthy",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString()
        });
      }
    }

    const overall = this.calculateOverallHealth(services);

    return {
      overall,
      services,
      timestamp: new Date().toISOString()
    };
  }

  private calculateOverallHealth(services: HealthStatus[]): "healthy" | "unhealthy" | "degraded" {
    if (services.length === 0) return "unhealthy";

    const unhealthy = services.filter(s => s.status === "unhealthy").length;
    const degraded = services.filter(s => s.status === "degraded").length;

    if (unhealthy > 0) return "unhealthy";
    if (degraded > 0) return "degraded";
    return "healthy";
  }
}

// Default health checker with common checks
export const healthChecker = new HealthChecker();

// Database health check
healthChecker.registerCheck("database", async (): Promise<HealthStatus> => {
  const start = Date.now();
  try {
    const appConfig = config.get();
    if (!appConfig.database.url) {
      throw new Error("Database URL not configured");
    }
    
    const responseTime = Date.now() - start;
    return {
      service: "database",
      status: responseTime < 1000 ? "healthy" : "degraded",
      responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: "database",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database connection failed",
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
});

// Supabase health check
healthChecker.registerCheck("supabase", async (): Promise<HealthStatus> => {
  const start = Date.now();
  try {
    const appConfig = config.get();
    const response = await fetch(`${appConfig.supabase.url}/rest/v1/`, {
      method: "HEAD",
      headers: {
        "apikey": appConfig.supabase.serviceKey,
        "Authorization": `Bearer ${appConfig.supabase.serviceKey}`
      }
    });

    const responseTime = Date.now() - start;
    
    if (response.ok) {
      return {
        service: "supabase",
        status: responseTime < 2000 ? "healthy" : "degraded",
        responseTime,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    return {
      service: "supabase",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Supabase connection failed",
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
});

// ATProto API health check
healthChecker.registerCheck("atproto", async (): Promise<HealthStatus> => {
  const start = Date.now();
  try {
    const appConfig = config.get();
    const response = await fetch(`${appConfig.atproto.service}/xrpc/_health`);
    
    const responseTime = Date.now() - start;
    
    if (response.ok) {
      return {
        service: "atproto",
        status: responseTime < 3000 ? "healthy" : "degraded",
        responseTime,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    return {
      service: "atproto",
      status: "unhealthy", 
      message: error instanceof Error ? error.message : "ATProto API connection failed",
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
});
