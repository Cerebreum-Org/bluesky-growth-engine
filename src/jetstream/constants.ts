/**
 * Jetstream collector constants and configuration
 */

export const JETSTREAM_CONFIG = {
  POST_BATCH_SIZE: 100,
  USER_BATCH_SIZE: 50,
  SOCIAL_GRAPH_BATCH_SIZE: 25,
  MEMORY_USAGE_THRESHOLD: 0.8,
  GC_INTERVAL_MS: 30000,
  MAX_POSTS_PER_USER: 500,
  RATE_LIMIT_DELAY_MS: 100,
  MAX_RETRIES: 3,
} as const;

export const COLLECTION_TYPES = {
  POSTS: "app.bsky.feed.post",
  LIKES: "app.bsky.feed.like", 
  REPOSTS: "app.bsky.feed.repost",
  FOLLOWS: "app.bsky.graph.follow",
  BLOCKS: "app.bsky.graph.block",
  LISTS: "app.bsky.graph.list",
  LIST_ITEMS: "app.bsky.graph.listitem",
  PROFILES: "app.bsky.actor.profile",
} as const;
