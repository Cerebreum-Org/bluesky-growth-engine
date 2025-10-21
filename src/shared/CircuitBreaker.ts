/**
 * Circuit breaker pattern implementation
 */

import { Result, Err } from "./Result.js";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Milliseconds to wait before trying again  
  monitorTimeout: number;      // Milliseconds to wait in half-open state
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;
  private successes = 0;

  constructor(
    private name: string, 
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitorTimeout: 5000
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<Result<T, string>> {
    // Check if circuit is open
    if (this.state === "open") {
      if (Date.now() < this.nextAttempt) {
        return Err(`${this.name}: Circuit breaker OPEN (${this.failures} failures)`);
      }
      // Move to half-open state
      this.state = "half-open";
    }

    try {
      const result = await operation();
      this.onSuccess();
      return { success: true, data: result };
    } catch (error) {
      this.onFailure();
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`${this.name}: Operation failed (attempt ${this.failures}): ${errorMessage}`);
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    
    if (this.state === "half-open") {
      this.state = "closed";
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    }
  }

  getState(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
    nextAttempt: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  // Alias for backward compatibility
  getStats() {
    return this.getState();
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
  }
}
