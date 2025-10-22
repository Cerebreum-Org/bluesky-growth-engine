/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by "opening" the circuit after repeated failures,
 * giving the downstream service time to recover.
 * 
 * States:
 * - CLOSED: Normal operation, all requests go through
 * - OPEN: Service is down, reject all requests immediately
 * - HALF_OPEN: Testing if service recovered, allow one request through
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker("database", {
 *   failureThreshold: 5,
 *   recoveryTimeout: 30000
 * });
 * 
 * const result = await breaker.execute(async () => {
 *   return await db.query("SELECT * FROM users");
 * });
 * 
 * if (result.ok) {
 *   console.log("Query succeeded:", result.value);
 * } else {
 *   console.error("Query failed:", result.error);
 * }
 * ```
 */

import { Result, Ok, Err } from "./Result.js";
import { Logger } from "./Logger.js";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Milliseconds to wait before trying again  
  monitorTimeout?: number;     // Milliseconds to wait in half-open state (unused for now)
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttempt: number;
  totalExecutions: number;
  totalFailures: number;
  totalSuccesses: number;
  openCount: number;           // Number of times circuit has opened
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;
  private totalExecutions = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private openCount = 0;
  private logger: Logger;

  constructor(
    private name: string, 
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitorTimeout: 5000
    }
  ) {
    this.logger = Logger.create(`CircuitBreaker:${name}`);
    this.logger.info("Circuit breaker initialized", {
      failure_threshold: options.failureThreshold,
      recovery_timeout: options.recoveryTimeout
    });
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<Result<T, string>> {
    this.totalExecutions++;

    // Check if circuit is open
    if (this.state === "open") {
      if (Date.now() < this.nextAttempt) {
        this.logger.warn("Circuit breaker OPEN - request rejected", {
          failures: this.failures,
          next_attempt_in: this.nextAttempt - Date.now()
        });
        return Err(`${this.name}: Circuit breaker OPEN (${this.failures} failures)`);
      }
      
      // Move to half-open state - let one request through
      this.logger.info("Circuit breaker moving to HALF_OPEN", {
        failures: this.failures
      });
      this.state = "half-open";
    }

    // Execute the operation
    try {
      const result = await operation();
      this.onSuccess();
      return Ok(result);
    } catch (error) {
      this.onFailure(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`${this.name}: Operation failed (attempt ${this.failures}): ${errorMessage}`);
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    const wasOpen = this.state === "open" || this.state === "half-open";
    
    this.failures = 0;
    this.successes++;
    this.totalSuccesses++;
    
    if (this.state === "half-open") {
      this.logger.info("Circuit breaker recovered - moving to CLOSED", {
        total_successes: this.totalSuccesses,
        total_failures: this.totalFailures
      });
      this.state = "closed";
    }

    if (wasOpen && this.state === "closed") {
      this.logger.info("Circuit breaker fully recovered", {
        open_duration: Date.now() - this.lastFailureTime
      });
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.logger.error("Operation failed", {
      failure_count: this.failures,
      threshold: this.options.failureThreshold,
      error: errorMessage
    });
    
    if (this.failures >= this.options.failureThreshold) {
      const wasOpen = this.state === "open";
      this.state = "open";
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      
      if (!wasOpen) {
        this.openCount++;
        this.logger.error("Circuit breaker OPENED", {
          failures: this.failures,
          total_failures: this.totalFailures,
          open_count: this.openCount,
          recovery_timeout: this.options.recoveryTimeout,
          next_attempt: new Date(this.nextAttempt).toISOString()
        });
      }
    }
  }

  /**
   * Get current state and metrics
   */
  getState(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      totalExecutions: this.totalExecutions,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      openCount: this.openCount
    };
  }

  /**
   * Alias for backward compatibility
   */
  getStats(): CircuitBreakerMetrics {
    return this.getState();
  }

  /**
   * Get human-readable status report
   */
  getStatusReport(): string {
    const metrics = this.getState();
    const successRate = metrics.totalExecutions > 0 
      ? ((metrics.totalSuccesses / metrics.totalExecutions) * 100).toFixed(2)
      : "0.00";
    
    return `
Circuit Breaker: ${this.name}
State: ${metrics.state.toUpperCase()}
Success Rate: ${successRate}%
Total: ${metrics.totalExecutions} executions (${metrics.totalSuccesses} success, ${metrics.totalFailures} failed)
Current: ${metrics.failures} consecutive failures
Opened: ${metrics.openCount} times
${metrics.state === "open" ? `Next Attempt: ${new Date(metrics.nextAttempt).toISOString()}` : ""}
    `.trim();
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.logger.info("Circuit breaker manually reset", {
      previous_state: this.state,
      total_failures: this.totalFailures
    });
    
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
    // Don't reset total counters - they're useful for historical tracking
  }

  /**
   * Force circuit breaker open (for testing or emergency shutdowns)
   */
  forceOpen(): void {
    this.logger.warn("Circuit breaker FORCED OPEN", {
      previous_state: this.state
    });
    this.state = "open";
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    this.openCount++;
  }

  /**
   * Force circuit breaker closed (use with caution!)
   */
  forceClosed(): void {
    this.logger.warn("Circuit breaker FORCED CLOSED", {
      previous_state: this.state,
      failures: this.failures
    });
    this.state = "closed";
    this.failures = 0;
    this.nextAttempt = 0;
  }
}
