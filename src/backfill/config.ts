/**
 * Backfill configuration and constants
 */

export const BACKFILL_CONFIG = {
  // Default batch sizes
  DEFAULT_BATCH_SIZE: parseInt(process.env.BATCH_SIZE ?? "50", 10),
  DEFAULT_RATE_LIMIT_DELAY: parseInt(process.env.RATE_LIMIT_DELAY ?? "100", 10),
  
  // Concurrency limits
  MAX_CONCURRENT_USERS: 5,
  MAX_CONCURRENT_REQUESTS: 10,
  
  // Data limits
  MAX_POSTS_PER_USER: parseInt(process.env.MAX_POSTS_PER_USER ?? "200", 10),
  MAX_FOLLOWERS_TO_PROCESS: 1000,
  MAX_FOLLOWING_TO_PROCESS: 1000,
  
  // Feature flags
  COLLECT_LIKES: process.env.COLLECT_LIKES === "true",
  COLLECT_REPOSTS: process.env.COLLECT_REPOSTS === "true", 
  COLLECT_FOLLOWS: process.env.COLLECT_FOLLOWS !== "false", // default true
  
  // Performance settings
  CHECKPOINT_INTERVAL: 100, // Save progress every N users
  MEMORY_CHECK_INTERVAL: 50,
  GC_THRESHOLD_MB: 500,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const;

export const TABLE_NAMES = {
  USERS: "bluesky_users",
  POSTS: "bluesky_posts", 
  FOLLOWS: "bluesky_follows",
  LIKES: "bluesky_likes",
  REPOSTS: "bluesky_reposts",
} as const;

export const RATE_LIMIT_HEADERS = {
  RESET: "ratelimit-reset",
  REMAINING: "ratelimit-remaining", 
  LIMIT: "ratelimit-limit",
} as const;
