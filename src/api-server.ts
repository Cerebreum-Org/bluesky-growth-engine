/**
 * Production-grade API server with reliability patterns
 */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import GrowthAnalytics from "./growth-analytics";
import { config } from "./shared/Config";
import { Logger } from "./shared/Logger";
import { ApiResponseBuilder } from "./shared/ApiResponse";
import { apiRateLimit } from "./shared/RateLimit";
import { healthChecker } from "./shared/HealthCheck";
import { unwrap } from "./shared/Result";

const logger = Logger.create("ApiServer");

// Load configuration at startup
const appConfigResult = config.load();
if (!appConfigResult.ok) {
  logger.error("Failed to load configuration", { error: appConfigResult.error });
  process.exit(1);
}
const appConfig = appConfigResult.value;

logger.info("API Server configuration loaded", {
  port: appConfig.server.port,
  environment: appConfig.server.environment,
  rate_limiting_enabled: appConfig.features.enableRateLimit
});
const app = express();
const PORT = appConfig.server.port;
const HOST = process.env.API_HOST || "0.0.0.0";

// ========================================
// MIDDLEWARE
// ========================================

// CORS configuration
app.use(cors({
  origin: [
    "http://100.69.129.86:3002", 
    "http://localhost:3002", 
    "http://localhost:3000",
    "http://localhost:5173" // Vite dev server
  ],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

// Request ID middleware for tracing
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  
  logger.info("Request received", {
    method: req.method,
    path: req.path,
    request_id: requestId,
    user_agent: req.get("User-Agent")
  });
  
  next();
});

// Rate limiting middleware
const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!appConfig.features.enableRateLimit) {
    return next();
  }

  const clientId = req.ip || "unknown";
  const rateLimitResult = apiRateLimit.isAllowed(clientId);

  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded", {
      client_id: clientId,
      path: req.path,
      reset_time: rateLimitResult.resetTime
    });

    res.status(429).json(
      ApiResponseBuilder.rateLimited("Too many requests. Please try again later.")
    );
    return;
  }

  // Add rate limit headers
  res.setHeader("X-RateLimit-Remaining", rateLimitResult.remaining || 0);
  res.setHeader("X-RateLimit-Reset", rateLimitResult.resetTime || 0);

  next();
};

app.use(rateLimitMiddleware);

// Enhanced error handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const requestId = req.headers["x-request-id"] as string;
      
      logger.apiError("endpoint_execution", error, {
        method: req.method,
        path: req.path,
        request_id: requestId
      });

      // Send standardized error response
      res.status(500).json(
        ApiResponseBuilder.serverError("Internal server error", {
          request_id: requestId,
          timestamp: new Date().toISOString()
        })
      );
    });
  };

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================

app.get("/health", asyncHandler(async (req: Request, res: Response) => {
  const health = await healthChecker.checkAll();
  
  const statusCode = health.overall === "healthy" ? 200 : 
                    health.overall === "degraded" ? 200 : 503;
  
  res.status(statusCode).json(
    ApiResponseBuilder.success(health, {
      requestId: req.headers["x-request-id"] as string
    })
  );
}));

// ========================================
// TRENDING & GROWTH ENDPOINTS
// ========================================

app.get("/api/trending", asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Cap at 100
  
  logger.info("Trending accounts request", { limit });
  
  const data = await GrowthAnalytics.getTrendingAccounts(limit);
  
  logger.apiSuccess("get_trending_accounts", { 
    limit, 
    results_count: data.length 
  });

  res.json(ApiResponseBuilder.success(data, {
    requestId: req.headers["x-request-id"] as string
  }));
}));

app.get("/api/growth-velocity", asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  
  logger.info("Growth velocity request", { limit });
  
  const data = await GrowthAnalytics.getGrowthVelocity(limit);
  
  logger.apiSuccess("get_growth_velocity", { 
    limit, 
    results_count: data.length 
  });

  res.json(ApiResponseBuilder.success(data, {
    requestId: req.headers["x-request-id"] as string
  }));
}));

app.get("/api/engagement-leaders", asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  
  logger.info("Engagement leaders request", { limit });
  
  const data = await GrowthAnalytics.getEngagementLeaders(limit);
  
  logger.apiSuccess("get_engagement_leaders", { 
    limit, 
    results_count: data.length 
  });

  res.json(ApiResponseBuilder.success(data, {
    requestId: req.headers["x-request-id"] as string
  }));
}));

app.get("/api/network-stats", asyncHandler(async (req: Request, res: Response) => {
  logger.info("Network stats request");
  
  const data = await GrowthAnalytics.getNetworkStats();
  
  logger.apiSuccess("get_network_stats", { 
    total_users: data.totalUsers,
    total_follows: data.totalFollows
  });

  res.json(ApiResponseBuilder.success(data, {
    requestId: req.headers["x-request-id"] as string
  }));
}));

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// 404 handler
app.use("*", (req: Request, res: Response) => {
  logger.warn("Route not found", { 
    method: req.method, 
    path: req.path 
  });

  res.status(404).json(
    ApiResponseBuilder.notFound(`Route ${req.method} ${req.path}`)
  );
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] as string;

  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    request_id: requestId
  });

  res.status(500).json(
    ApiResponseBuilder.serverError("An unexpected error occurred", {
      request_id: requestId
    })
  );
});

// ========================================
// SERVER STARTUP
// ========================================

const server = app.listen(PORT, HOST, () => {
  logger.info(`API Server started successfully`, {
    host: HOST,
    port: PORT,
    environment: appConfig.server.environment,
    node_version: process.version,
    uptime: process.uptime()
  });
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  
  server.close((err) => {
    if (err) {
      logger.error("Error during server shutdown", { error: err.message });
      process.exit(1);
    }
    
    logger.info("Server closed successfully");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close();
  process.exit(0);
});

export default app;
