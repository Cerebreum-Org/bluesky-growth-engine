/**
 * Production startup validation
 * 
 * Validates system health before starting services:
 * - Configuration validation
 * - Database connectivity 
 * - External service availability
 * - Environment requirements
 */

import { config } from "./shared/Config.js";
import { Logger } from "./shared/Logger.js";
import { healthChecker } from "./shared/HealthCheck.js";
import { enhancedSupabase } from "./supabase-enhanced.js";
import { Result } from "./shared/Result.js";

const logger = Logger.create("StartupValidator");

interface ValidationResult {
  component: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

/**
 * Comprehensive startup validation
 */
export class StartupValidator {
  private validationResults: ValidationResult[] = [];

  /**
   * Run all startup validations
   */
  async validate(): Promise<Result<void>> {
    logger.info("Starting comprehensive system validation");

    // Run all validations
    await this.validateConfiguration();
    await this.validateDatabaseConnectivity();
    await this.validateExternalServices();
    await this.validateEnvironment();

    // Analyze results
    const failures = this.validationResults.filter(r => r.status === "fail");
    const warnings = this.validationResults.filter(r => r.status === "warning");

    // Log summary
    logger.info("Startup validation completed", {
      total_checks: this.validationResults.length,
      passed: this.validationResults.filter(r => r.status === "pass").length,
      warnings: warnings.length,
      failures: failures.length
    });

    // Log individual results
    this.validationResults.forEach(result => {
      if (result.status === "fail") {
        logger.error(`Validation failed: ${result.component}`, {
          message: result.message,
          details: result.details
        });
      } else if (result.status === "warning") {
        logger.warn(`Validation warning: ${result.component}`, {
          message: result.message,
          details: result.details
        });
      } else {
        logger.debug(`Validation passed: ${result.component}`, {
          message: result.message
        });
      }
    });

    if (failures.length > 0) {
      return (Result.success ? undefined : (Result.error || "Unknown error"))(`Startup validation failed: ${failures.length} critical issues found`);
    }

    if (warnings.length > 0) {
      logger.warn(`Startup validation completed with ${warnings.length} warnings`);
    }

    return Result.success(undefined);
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<void> {
    try {
      const appConfig = config.get();

      // Check required environment variables
      const requiredEnvVars = [
        "DATABASE_URL",
        "SUPABASE_URL", 
        "SUPABASE_SERVICE_ROLE_KEY"
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        this.validationResults.push({
          component: "Configuration",
          status: "fail",
          message: `Missing required environment variables: ${missingVars.join(", ")}`,
          details: { missing_vars: missingVars }
        });
        return;
      }

      // Validate configuration values
      const configIssues = [];

      if (appConfig.database.poolMax < appConfig.database.poolMin) {
        configIssues.push("DB_POOL_MAX must be greater than DB_POOL_MIN");
      }

      if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
        configIssues.push("Invalid server port number");
      }

      if (appConfig.atproto.rateLimitPerSecond < 1) {
        configIssues.push("ATPROTO_RATE_LIMIT must be at least 1");
      }

      if (configIssues.length > 0) {
        this.validationResults.push({
          component: "Configuration",
          status: "fail",
          message: "Invalid configuration values",
          details: { issues: configIssues }
        });
        return;
      }

      this.validationResults.push({
        component: "Configuration",
        status: "pass",
        message: "All configuration values are valid",
        details: {
          environment: appConfig.server.environment,
          circuit_breaker_enabled: appConfig.features.enableCircuitBreaker,
          rate_limit_enabled: appConfig.features.enableRateLimit
        }
      });

    } catch (error) {
      this.validationResults.push({
        component: "Configuration",
        status: "fail",
        message: "Failed to load configuration",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Validate database connectivity
   */
  private async validateDatabaseConnectivity(): Promise<void> {
    try {
      const healthResult = await enhancedSupabase.healthCheck();

      if (!healthResult.success) {
        this.validationResults.push({
          component: "Database",
          status: "fail",
          message: "Database health check failed",
          details: { error: (healthResult.success ? undefined : (healthResult.error || "Unknown error")) }
        });
        return;
      }

      const { status, responseTime } = healthResult.data;

      if (responseTime > 5000) {
        this.validationResults.push({
          component: "Database",
          status: "warning",
          message: "Database response time is slow",
          details: { response_time: responseTime, threshold: 5000 }
        });
      } else {
        this.validationResults.push({
          component: "Database",
          status: "pass",
          message: "Database connectivity verified",
          details: { response_time: responseTime }
        });
      }

      // Test basic table access
      const tableTestResult = await enhancedSupabase.select("bluesky_users", { limit: 1 });
      if (!tableTestResult.success) {
        this.validationResults.push({
          component: "Database Schema",
          status: "warning",
          message: "Cannot access bluesky_users table",
          details: { error: (tableTestResult.success ? undefined : (tableTestResult.error || "Unknown error")) }
        });
      } else {
        this.validationResults.push({
          component: "Database Schema",
          status: "pass",
          message: "Database schema accessible"
        });
      }

    } catch (error) {
      this.validationResults.push({
        component: "Database",
        status: "fail",
        message: "Database validation failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Validate external services
   */
  private async validateExternalServices(): Promise<void> {
    try {
      const healthStatus = await healthChecker.checkAll();

      healthStatus.services.forEach(service => {
        if (service.status === "unhealthy") {
          this.validationResults.push({
            component: `External Service (${service.service})`,
            status: "fail",
            message: service.message || "Service is unhealthy",
            details: { 
              response_time: service.responseTime,
              timestamp: service.timestamp
            }
          });
        } else if (service.status === "degraded") {
          this.validationResults.push({
            component: `External Service (${service.service})`,
            status: "warning",
            message: service.message || "Service is degraded",
            details: { 
              response_time: service.responseTime,
              timestamp: service.timestamp
            }
          });
        } else {
          this.validationResults.push({
            component: `External Service (${service.service})`,
            status: "pass",
            message: "Service is healthy",
            details: { 
              response_time: service.responseTime
            }
          });
        }
      });

    } catch (error) {
      this.validationResults.push({
        component: "External Services",
        status: "fail",
        message: "Failed to check external services",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Validate environment requirements
   */
  private async validateEnvironment(): Promise<void> {
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

      if (majorVersion < 18) {
        this.validationResults.push({
          component: "Node.js Version",
          status: "fail",
          message: `Node.js version ${nodeVersion} is not supported. Minimum required: v18`,
          details: { current_version: nodeVersion, minimum_required: "v18" }
        });
      } else {
        this.validationResults.push({
          component: "Node.js Version",
          status: "pass",
          message: `Node.js version ${nodeVersion} is supported`,
          details: { version: nodeVersion }
        });
      }

      // Check memory availability
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      if (totalMemoryMB < 512) {
        this.validationResults.push({
          component: "Memory",
          status: "warning",
          message: "Available memory may be insufficient for production workloads",
          details: { 
            heap_total_mb: totalMemoryMB,
            recommended_mb: 1024
          }
        });
      } else {
        this.validationResults.push({
          component: "Memory",
          status: "pass",
          message: "Sufficient memory available",
          details: { heap_total_mb: totalMemoryMB }
        });
      }

      // Check file system permissions
      try {
        const fs = await import("fs/promises");
        await fs.access(".", fs.constants.R_OK | fs.constants.W_OK);
        
        this.validationResults.push({
          component: "File System",
          status: "pass",
          message: "File system permissions are adequate"
        });
      } catch (error) {
        this.validationResults.push({
          component: "File System",
          status: "fail",
          message: "Insufficient file system permissions",
          details: { error: error instanceof Error ? error.message : error }
        });
      }

    } catch (error) {
      this.validationResults.push({
        component: "Environment",
        status: "fail",
        message: "Environment validation failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Get validation results
   */
  getResults(): ValidationResult[] {
    return [...this.validationResults];
  }

  /**
   * Generate validation report
   */
  generateReport(): string {
    const passed = this.validationResults.filter(r => r.status === "pass").length;
    const warnings = this.validationResults.filter(r => r.status === "warning").length;
    const failures = this.validationResults.filter(r => r.status === "fail").length;

    let report = "=== STARTUP VALIDATION REPORT ===\\n\\n";
    report += `Summary: ${passed} passed, ${warnings} warnings, ${failures} failures\\n\\n`;

    if (failures > 0) {
      report += "❌ FAILURES:\\n";
      this.validationResults
        .filter(r => r.status === "fail")
        .forEach(result => {
          report += `  • ${result.component}: ${result.message}\\n`;
        });
      report += "\\n";
    }

    if (warnings > 0) {
      report += "⚠️  WARNINGS:\\n";
      this.validationResults
        .filter(r => r.status === "warning")
        .forEach(result => {
          report += `  • ${result.component}: ${result.message}\\n`;
        });
      report += "\\n";
    }

    report += "✅ PASSED:\\n";
    this.validationResults
      .filter(r => r.status === "pass")
      .forEach(result => {
        report += `  • ${result.component}: ${result.message}\\n`;
      });

    return report;
  }
}

// Create and export validator instance
export const startupValidator = new StartupValidator();
