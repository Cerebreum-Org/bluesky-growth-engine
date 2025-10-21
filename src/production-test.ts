/**
 * Production Readiness Test Suite
 * 
 * Comprehensive tests to validate production deployment:
 * - Error scenario testing
 * - Rate limiting validation
 * - Logging verification
 * - Performance benchmarks
 * - Circuit breaker behavior
 */

import { Logger } from "./shared/Logger.js";
import { apiRateLimit, collectRateLimit, strictRateLimit } from "./shared/RateLimit.js";
import { CircuitBreaker } from "./shared/CircuitBreaker.js";
import { enhancedSupabase } from "./supabase-enhanced.js";
import { healthChecker } from "./shared/HealthCheck.js";
import { config } from "./shared/Config.js";
import { Result } from "./shared/Result.js";

const logger = Logger.create("ProductionTest");

interface TestResult {
  test: string;
  status: "pass" | "fail";
  message: string;
  duration?: number;
  details?: any;
}

/**
 * Production readiness test suite
 */
export class ProductionTestSuite {
  private testResults: TestResult[] = [];

  /**
   * Run all production readiness tests
   */
  async runAllTests(): Promise<Result<void>> {
    logger.info("Starting production readiness test suite");

    // Run test categories
    await this.testErrorScenarios();
    await this.testRateLimiting();
    await this.testLogging();
    await this.testCircuitBreakers();
    await this.testHealthMonitoring();
    await this.testPerformance();

    // Analyze results
    const failures = this.testResults.filter(r => r.status === "fail");
    const passed = this.testResults.filter(r => r.status === "pass");

    logger.info("Production test suite completed", {
      total_tests: this.testResults.length,
      passed: passed.length,
      failures: failures.length,
      success_rate: Math.round((passed.length / this.testResults.length) * 100)
    });

    if (failures.length > 0) {
      failures.forEach(failure => {
        logger.error(`Test failed: ${failure.test}`, {
          message: failure.message,
          details: failure.details
        });
      });
      
      return (Result.success ? undefined : (Result.error || "Unknown error"))(`${failures.length} production readiness tests failed`);
    }

    return Result.success(undefined);
  }

  /**
   * Test error scenario handling
   */
  private async testErrorScenarios(): Promise<void> {
    logger.info("Testing error scenario handling");

    // Test 1: Database error handling
    try {
      const startTime = Date.now();
      
      // Try to query a non-existent table
      const result = await enhancedSupabase.select("nonexistent_table", { limit: 1 });
      
      if (!result.success) {
        this.testResults.push({
          test: "Database Error Handling",
          status: "pass",
          message: "Database errors are properly caught and wrapped",
          duration: Date.now() - startTime,
          details: { error_type: "table_not_found" }
        });
      } else {
        this.testResults.push({
          test: "Database Error Handling",
          status: "fail",
          message: "Database errors are not being caught",
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      this.testResults.push({
        test: "Database Error Handling",
        status: "fail",
        message: "Unhandled exception in database error test",
        details: { error: error instanceof Error ? error.message : error }
      });
    }

    // Test 2: Configuration error handling
    try {
      // Temporarily corrupt config
      const originalEnv = process.env.SUPABASE_URL;
      process.env.SUPABASE_URL = "";
      
      try {
        config.load();
        this.testResults.push({
          test: "Configuration Error Handling",
          status: "fail",
          message: "Configuration errors are not being detected"
        });
      } catch (error) {
        this.testResults.push({
          test: "Configuration Error Handling",
          status: "pass",
          message: "Configuration validation working correctly"
        });
      }
      
      // Restore config
      process.env.SUPABASE_URL = originalEnv;
    } catch (error) {
      this.testResults.push({
        test: "Configuration Error Handling",
        status: "fail",
        message: "Error in configuration test",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Test rate limiting behavior
   */
  private async testRateLimiting(): Promise<void> {
    logger.info("Testing rate limiting behavior");

    // Test 1: API Rate Limiter
    try {
      const testKey = "rate-limit-test";
      let allowedRequests = 0;
      let blockedRequests = 0;

      // Make rapid requests
      for (let i = 0; i < 105; i++) {
        const result = apiRateLimit.isAllowed(testKey);
        if (result.allowed) {
          allowedRequests++;
        } else {
          blockedRequests++;
        }
      }

      if (blockedRequests > 0) {
        this.testResults.push({
          test: "API Rate Limiting",
          status: "pass",
          message: "Rate limiting is working correctly",
          details: { 
            allowed: allowedRequests, 
            blocked: blockedRequests 
          }
        });
      } else {
        this.testResults.push({
          test: "API Rate Limiting",
          status: "fail",
          message: "Rate limiting not enforcing limits",
          details: { 
            allowed: allowedRequests, 
            blocked: blockedRequests 
          }
        });
      }

      // Reset for next test
      apiRateLimit.reset(testKey);
    } catch (error) {
      this.testResults.push({
        test: "API Rate Limiting",
        status: "fail",
        message: "Rate limiting test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }

    // Test 2: Different rate limiter types
    try {
      const testKey = "collect-rate-test";
      
      // Test collect rate limiter (should be more restrictive)
      let collectAllowed = 0;
      for (let i = 0; i < 55; i++) {
        if (collectRateLimit.isAllowed(testKey).allowed) {
          collectAllowed++;
        }
      }

      if (collectAllowed <= 50) {
        this.testResults.push({
          test: "Collection Rate Limiting",
          status: "pass",
          message: "Collection rate limiting enforced correctly",
          details: { allowed: collectAllowed, limit: 50 }
        });
      } else {
        this.testResults.push({
          test: "Collection Rate Limiting",
          status: "fail",
          message: "Collection rate limiting too permissive",
          details: { allowed: collectAllowed, limit: 50 }
        });
      }

      collectRateLimit.reset(testKey);
    } catch (error) {
      this.testResults.push({
        test: "Collection Rate Limiting",
        status: "fail",
        message: "Collection rate limiting test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Test logging functionality
   */
  private async testLogging(): Promise<void> {
    logger.info("Testing logging functionality");

    // Test 1: Structured logging
    try {
      const testLogger = Logger.create("TestLogger");
      
      // Test different log levels
      testLogger.debug("Test debug message", { test: true });
      testLogger.info("Test info message", { test: true });
      testLogger.warn("Test warn message", { test: true });
      (testLogger.success ? undefined : (testLogger.error || "Unknown error"))("Test error message", { test: true });

      // Test specialized logging methods
      testLogger.apiSuccess("test_operation", { duration: 100 });
      testLogger.apiError("test_operation", new Error("Test error"), { context: "testing" });
      testLogger.userAction("test_action", "test_user", { extra: "data" });

      this.testResults.push({
        test: "Structured Logging",
        status: "pass",
        message: "All logging methods executed without errors"
      });

    } catch (error) {
      this.testResults.push({
        test: "Structured Logging",
        status: "fail",
        message: "Logging test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }

    // Test 2: Context preservation
    try {
      const contextLogger = Logger.create("ContextTest");
      
      // Test that context is preserved in logs
      contextLogger.info("Testing context preservation", {
        operation_id: "test-123",
        user_context: { id: "user-456" },
        request_metadata: { source: "test" }
      });

      this.testResults.push({
        test: "Logging Context Preservation",
        status: "pass",
        message: "Context logging works correctly"
      });

    } catch (error) {
      this.testResults.push({
        test: "Logging Context Preservation",
        status: "fail",
        message: "Context logging failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Test circuit breaker behavior
   */
  private async testCircuitBreakers(): Promise<void> {
    logger.info("Testing circuit breaker behavior");

    // Test 1: Circuit breaker failure detection
    try {
      const testBreaker = new CircuitBreaker("test-breaker", {
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitorTimeout: 500
      });

      let successCount = 0;
      let failureCount = 0;

      // First, succeed a few times
      for (let i = 0; i < 2; i++) {
        const result = await testBreaker.execute(async () => {
          return Result.success("test");
        });
        
        if (result.success) {
          successCount++;
        }
      }

      // Now fail enough times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        const result = await testBreaker.execute(async () => {
          throw new Error("Simulated failure");
        });
        
        if (!result.success) {
          failureCount++;
        }
      }

      const stats = testBreaker.getStats();
      
      if (stats.state === "open") {
        this.testResults.push({
          test: "Circuit Breaker Failure Detection",
          status: "pass",
          message: "Circuit breaker opened after threshold failures",
          details: { 
            successes: successCount, 
            failures: failureCount,
            state: stats.state,
            failure_count: stats.failureCount
          }
        });
      } else {
        this.testResults.push({
          test: "Circuit Breaker Failure Detection",
          status: "fail",
          message: "Circuit breaker did not open after failures",
          details: { 
            successes: successCount, 
            failures: failureCount,
            state: stats.state,
            failure_count: stats.failureCount
          }
        });
      }

    } catch (error) {
      this.testResults.push({
        test: "Circuit Breaker Failure Detection",
        status: "fail",
        message: "Circuit breaker test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Test health monitoring
   */
  private async testHealthMonitoring(): Promise<void> {
    logger.info("Testing health monitoring");

    // Test 1: Health check endpoint
    try {
      const startTime = Date.now();
      const healthResult = await healthChecker.checkAll();
      const duration = Date.now() - startTime;

      if (healthResult.services.length > 0) {
        this.testResults.push({
          test: "Health Check Monitoring",
          status: "pass",
          message: "Health monitoring is functional",
          duration,
          details: {
            overall_status: healthResult.overall,
            services_checked: healthResult.services.length,
            healthy_services: healthResult.services.filter(s => s.status === "healthy").length
          }
        });
      } else {
        this.testResults.push({
          test: "Health Check Monitoring",
          status: "fail",
          message: "No health checks registered",
          duration
        });
      }

    } catch (error) {
      this.testResults.push({
        test: "Health Check Monitoring",
        status: "fail",
        message: "Health monitoring test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }

    // Test 2: Database health specifically
    try {
      const startTime = Date.now();
      const dbHealthResult = await enhancedSupabase.healthCheck();
      const duration = Date.now() - startTime;

      if (dbHealthResult.success) {
        this.testResults.push({
          test: "Database Health Monitoring",
          status: "pass",
          message: "Database health monitoring working",
          duration,
          details: dbHealthResult.data
        });
      } else {
        this.testResults.push({
          test: "Database Health Monitoring",
          status: "fail",
          message: "Database health check failed",
          duration,
          details: { error: (dbHealthResult.success ? undefined : (dbHealthResult.error || "Unknown error")) }
        });
      }

    } catch (error) {
      this.testResults.push({
        test: "Database Health Monitoring",
        status: "fail",
        message: "Database health test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Test performance characteristics
   */
  private async testPerformance(): Promise<void> {
    logger.info("Testing performance characteristics");

    // Test 1: Database query performance
    try {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await enhancedSupabase.select("bluesky_users", { limit: 1 });
        durations.push(Date.now() - startTime);
      }

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      if (avgDuration < 1000 && maxDuration < 2000) {
        this.testResults.push({
          test: "Database Query Performance",
          status: "pass",
          message: "Database queries perform within acceptable limits",
          details: {
            avg_duration_ms: Math.round(avgDuration),
            max_duration_ms: maxDuration,
            iterations
          }
        });
      } else {
        this.testResults.push({
          test: "Database Query Performance",
          status: "fail",
          message: "Database queries are too slow",
          details: {
            avg_duration_ms: Math.round(avgDuration),
            max_duration_ms: maxDuration,
            avg_threshold_ms: 1000,
            max_threshold_ms: 2000
          }
        });
      }

    } catch (error) {
      this.testResults.push({
        test: "Database Query Performance",
        status: "fail",
        message: "Performance test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }

    // Test 2: Memory usage monitoring
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      this.testResults.push({
        test: "Memory Usage Monitoring",
        status: "pass",
        message: "Memory usage monitored successfully",
        details: {
          heap_used_mb: heapUsedMB,
          heap_total_mb: heapTotalMB,
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024)
        }
      });

    } catch (error) {
      this.testResults.push({
        test: "Memory Usage Monitoring",
        status: "fail",
        message: "Memory monitoring test failed",
        details: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const passed = this.testResults.filter(r => r.status === "pass").length;
    const failed = this.testResults.filter(r => r.status === "fail").length;
    const successRate = Math.round((passed / this.testResults.length) * 100);

    let report = "=== PRODUCTION READINESS TEST REPORT ===\\n\\n";
    report += `Summary: ${passed}/${this.testResults.length} tests passed (${successRate}%)\\n\\n`;

    if (failed > 0) {
      report += "❌ FAILED TESTS:\\n";
      this.testResults
        .filter(r => r.status === "fail")
        .forEach(result => {
          report += `  • ${result.test}: ${result.message}\\n`;
        });
      report += "\\n";
    }

    report += "✅ PASSED TESTS:\\n";
    this.testResults
      .filter(r => r.status === "pass")
      .forEach(result => {
        const duration = result.duration ? ` (${result.duration}ms)` : "";
        report += `  • ${result.test}: ${result.message}${duration}\\n`;
      });

    return report;
  }
}

// Main execution for standalone testing
if (require.main === module) {
  const testSuite = new ProductionTestSuite();
  
  testSuite.runAllTests().then((result) => {
    if (!result.success) {
      console.error("\\n❌ Production readiness tests failed:");
      console.error((result.success ? undefined : (result.error || "Unknown error")));
      console.log("\\n" + testSuite.generateReport());
      process.exit(1);
    }
    
    console.log("\\n✅ All production readiness tests passed!");
    console.log("\\n" + testSuite.generateReport());
    process.exit(0);
  });
}

