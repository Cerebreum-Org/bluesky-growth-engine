/**
 * Standardized API response wrapper
 * 
 * BEFORE: Every endpoint returns different structure
 * AFTER: Consistent responses, proper error codes, debug info
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export class ApiResponseBuilder {
  static success<T>(data: T, meta?: Partial<ApiResponse["meta"]>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  static error(
    code: string, 
    message: string, 
    details?: any, 
    meta?: Partial<ApiResponse["meta"]>
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  // Common error types
  static validationError(message: string, details?: any): ApiResponse {
    return this.error("VALIDATION_ERROR", message, details);
  }

  static notFound(resource: string): ApiResponse {
    return this.error("NOT_FOUND", `${resource} not found`);
  }

  static unauthorized(message: string = "Unauthorized"): ApiResponse {
    return this.error("UNAUTHORIZED", message);
  }

  static serverError(message: string = "Internal server error", details?: any): ApiResponse {
    return this.error("SERVER_ERROR", message, details);
  }

  static rateLimited(message: string = "Rate limit exceeded"): ApiResponse {
    return this.error("RATE_LIMITED", message);
  }

  static badRequest(message: string, details?: any): ApiResponse {
    return this.error("BAD_REQUEST", message, details);
  }
}
