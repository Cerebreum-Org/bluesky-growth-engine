/**
 * Backfill Configuration
 */

export const backfillConfig = {
  batchSize: Number(process.env.BATCH_SIZE ?? '50'),
  rateLimitDelay: Number(process.env.RATE_LIMIT_DELAY ?? '2000'),
  maxPostsPerUser: Infinity,
  skipFollows: false,
  collectLikesReposts: true,
  concurrency: Number(process.env.CONCURRENCY ?? '1'),
  maxRetries: 3,
} as const;

export interface BackfillStats {
  totalUsers: number;
  processedUsers: number;
  totalPosts: number;
  totalLikes: number;
  totalReposts: number;
  totalFollows: number;
}

export function createStats(): BackfillStats {
  return {
    totalUsers: 0,
    processedUsers: 0,
    totalPosts: 0,
    totalLikes: 0,
    totalReposts: 0,
    totalFollows: 0,
  };
}
