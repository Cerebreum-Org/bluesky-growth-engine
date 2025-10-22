/**
 * Structured Logger with Context
 * 
 * Provides contextual, structured logging that makes debugging actually useful.
 * No more "Error collecting user" - now you get WHO, WHAT, WHEN, WHY with full context.
 * 
 * Features:
 * - Structured JSON logging with timestamps
 * - Context inheritance (module, operation, user, etc.)
 * - Correlation IDs for request tracing
 * - Performance timing
 * - Log level filtering
 * - Common pattern helpers (API calls, user actions)
 * 
 * @example
 * ```typescript
 * const logger = Logger.create("UserService");
 * 
 * logger.info("Processing user", { user_id: "123", action: "fetch" });
 * // [UserService] Processing user {"level":"INFO","context":"UserService",...}
 * 
 * const timer = logger.startTimer();
 * await fetchUser();
 * timer.end("User fetch completed");
 * // Logs with duration_ms
 * ```
 */

export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  timestamp: string;
  correlation_id?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface Timer {
  end: (message: string, context?: LogContext) => void;
}

/**
 * Structured logger with contextual information
 */
export class Logger {
  private context: string;
  private correlationId?: string;
  private static minLevel: LogLevel = "DEBUG";

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId;
  }

  /**
   * Create a new logger with context
   */
  static create(context: string, correlationId?: string): Logger {
    return new Logger(context, correlationId);
  }

  /**
   * Set minimum log level globally (DEBUG, INFO, WARN, ERROR)
   */
  static setMinLevel(level: LogLevel): void {
    Logger.minLevel = level;
  }

  /**
   * Get current minimum log level
   */
  static getMinLevel(): LogLevel {
    return Logger.minLevel;
  }

  /**
   * Create child logger with additional context
   */
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.correlationId);
  }

  /**
   * Create logger with correlation ID for request tracing
   */
  withCorrelationId(correlationId: string): Logger {
    return new Logger(this.context, correlationId);
  }

  /**
   * Start a timer for performance tracking
   */
  startTimer(): Timer {
    const startTime = Date.now();
    return {
      end: (message: string, context: LogContext = {}) => {
        const duration = Date.now() - startTime;
        this.info(message, { ...context, duration_ms: duration });
      }
    };
  }

  /**
   * Log error message
   */
  error(message: string, context: LogContext = {}): void {
    this.log("ERROR", message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context: LogContext = {}): void {
    this.log("WARN", message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context: LogContext = {}): void {
    this.log("INFO", message, context);
  }

  /**
   * Log debug message (only if DEBUG env var is set or minLevel is DEBUG)
   */
  debug(message: string, context: LogContext = {}): void {
    if (process.env.DEBUG || Logger.minLevel === "DEBUG") {
      this.log("DEBUG", message, context);
    }
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    // Check if we should log based on min level
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (this.correlationId) {
      logEntry.correlation_id = this.correlationId;
    }

    // Format output based on level
    const prefix = `[${this.context}] ${message}`;
    const structured = JSON.stringify(logEntry, null, 2);

    switch (level) {
      case "ERROR":
        console.error(prefix, structured);
        break;
      case "WARN":
        console.warn(prefix, structured);
        break;
      case "INFO":
      case "DEBUG":
      default:
        console.log(prefix, structured);
        break;
    }
  }

  /**
   * Check if we should log based on min level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(Logger.minLevel);
    return currentIndex >= minIndex;
  }

  // ============================================================================
  // Common Pattern Helpers
  // ============================================================================

  /**
   * Log API operation failure
   */
  apiError(operation: string, error: Error | unknown, context: LogContext = {}): void {
    const errorInfo = this.extractErrorInfo(error);
    this.error(`API operation failed: ${operation}`, {
      operation,
      ...errorInfo,
      ...context
    });
  }

  /**
   * Log API operation success
   */
  apiSuccess(operation: string, context: LogContext = {}): void {
    this.info(`API operation succeeded: ${operation}`, {
      operation,
      ...context
    });
  }

  /**
   * Log user action
   */
  userAction(action: string, userDid: string, context: LogContext = {}): void {
    this.info(`User action: ${action}`, {
      user_did: userDid,
      action,
      ...context
    });
  }

  /**
   * Log database operation
   */
  dbOperation(operation: string, table: string, context: LogContext = {}): void {
    this.debug(`Database operation: ${operation}`, {
      operation,
      table,
      ...context
    });
  }

  /**
   * Log database error
   */
  dbError(operation: string, table: string, error: Error | unknown, context: LogContext = {}): void {
    const errorInfo = this.extractErrorInfo(error);
    this.error(`Database operation failed: ${operation}`, {
      operation,
      table,
      ...errorInfo,
      ...context
    });
  }

  /**
   * Log rate limit hit
   */
  rateLimitHit(service: string, context: LogContext = {}): void {
    this.warn(`Rate limit hit: ${service}`, {
      service,
      ...context
    });
  }

  /**
   * Log circuit breaker opened
   */
  circuitBreakerOpen(service: string, context: LogContext = {}): void {
    this.error(`Circuit breaker opened: ${service}`, {
      service,
      ...context
    });
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Extract structured error information
   */
  private extractErrorInfo(error: Error | unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack
      };
    }
    return {
      error_message: String(error),
      error_type: typeof error
    };
  }
}

// ============================================================================
// Pre-configured Loggers for Common Modules
// ============================================================================

export const collectLogger = Logger.create("UserCollector");
export const strategiesLogger = Logger.create("Strategies");
export const jetstreamLogger = Logger.create("JetstreamCollector");
export const backfillLogger = Logger.create("Backfill");
export const apiLogger = Logger.create("ApiServer");
export const dbLogger = Logger.create("Database");

// ============================================================================
// Environment-based Configuration
// ============================================================================

// Set log level from environment variable
const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel | undefined;
if (envLogLevel && ["DEBUG", "INFO", "WARN", "ERROR"].includes(envLogLevel)) {
  Logger.setMinLevel(envLogLevel);
} else if (process.env.NODE_ENV === "production") {
  Logger.setMinLevel("INFO");
} else {
  Logger.setMinLevel("DEBUG");
}
