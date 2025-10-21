/**
 * Simple, contextual logger that makes debugging actually useful
 * 
 * No more "Error collecting user" - now you get WHO, WHAT, WHEN, WHY
 */

interface LogContext {
  [key: string]: any;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  static create(context: string): Logger {
    return new Logger(context);
  }

  error(message: string, context: LogContext = {}) {
    const logEntry = {
      level: "ERROR",
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...context
    };
    console.error(`[${this.context}] ${message}`, JSON.stringify(logEntry, null, 2));
  }

  warn(message: string, context: LogContext = {}) {
    const logEntry = {
      level: "WARN",
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...context
    };
    console.warn(`[${this.context}] ${message}`, JSON.stringify(logEntry, null, 2));
  }

  info(message: string, context: LogContext = {}) {
    const logEntry = {
      level: "INFO",
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...context
    };
    console.log(`[${this.context}] ${message}`, JSON.stringify(logEntry, null, 2));
  }

  debug(message: string, context: LogContext = {}) {
    // Only show debug logs if DEBUG env var is set
    if (process.env.DEBUG) {
      const logEntry = {
        level: "DEBUG",
        context: this.context,
        message,
        timestamp: new Date().toISOString(),
        ...context
      };
      console.log(`[${this.context}] ${message}`, JSON.stringify(logEntry, null, 2));
    }
  }

  // Shorthand for common patterns
  apiError(operation: string, error: Error, context: LogContext = {}) {
    this.error(`API operation failed: ${operation}`, {
      error_message: error.message,
      error_name: error.name,
      operation,
      ...context
    });
  }

  apiSuccess(operation: string, context: LogContext = {}) {
    this.info(`API operation succeeded: ${operation}`, {
      operation,
      ...context
    });
  }

  userAction(action: string, userDid: string, context: LogContext = {}) {
    this.info(`User action: ${action}`, {
      user_did: userDid,
      action,
      ...context
    });
  }
}

// Pre-configured loggers for common modules
export const collectLogger = Logger.create("UserCollector");
export const strategiesLogger = Logger.create("Strategies");
export const jetstreamLogger = Logger.create("JetstreamCollector");
export const backfillLogger = Logger.create("Backfill");
