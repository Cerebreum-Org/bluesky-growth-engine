/**
 * Production-grade Jetstream Real-Time Collector with reliability patterns
 * 
 * Collects ALL Bluesky activity in real-time with:
 * - Circuit breaker protection
 * - Connection health monitoring  
 * - Graceful error recovery
 * - Structured logging
 * - Batched database operations
 */

import "dotenv/config";
import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";
import { supabase } from "./supabase";
import { Result } from "./shared/Result";
import { Logger } from "./shared/Logger";
import { CircuitBreaker } from "./shared/CircuitBreaker";
import { config } from "./shared/Config";
import type { 
  PostRecord, 
  LikeRecord, 
  RepostRecord, 
  FollowRecord 
} from "./types/atproto-events";

// Initialize configuration and logging
const appConfig = config.get();
const logger = Logger.create("JetstreamCollector");

// Circuit breakers
const jetstreamBreaker = new CircuitBreaker("jetstream-connection", {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  monitorTimeout: 10000
});

const supabaseBreaker = new CircuitBreaker("supabase-batch", {
  failureThreshold: 5,
  recoveryTimeout: 20000,
  monitorTimeout: 5000
});

// Configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000;

// Queue interfaces
interface QueuedUser {
  did: string;
  handle?: string;
}

interface QueuedPost {
  uri: string;
  cid: string;
  author_did: string;
  text?: string;
  created_at: string;
  like_count?: number;
  repost_count?: number;
  reply_count?: number;
}

interface QueuedLike {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

interface QueuedRepost {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

interface QueuedFollow {
  uri: string;
  author_did: string;
  subject_did: string;
  created_at: string;
}

interface CollectorStats {
  totalEvents: number;
  postsProcessed: number;
  likesProcessed: number;
  repostsProcessed: number;
  followsProcessed: number;
  usersProcessed: number;
  errors: number;
  lastFlushTime: Date;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
}

/**
 * Enhanced Jetstream Collector with reliability patterns
 */
export class EnhancedJetstreamCollector {
  private jetstream: Jetstream | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  // Data queues
  private userQueue: QueuedUser[] = [];
  private postQueue: QueuedPost[] = [];
  private likeQueue: QueuedLike[] = [];
  private repostQueue: QueuedRepost[] = [];
  private followQueue: QueuedFollow[] = [];

  // Statistics
  private stats: CollectorStats = {
    totalEvents: 0,
    postsProcessed: 0,
    likesProcessed: 0,
    repostsProcessed: 0,
    followsProcessed: 0,
    usersProcessed: 0,
    errors: 0,
    lastFlushTime: new Date(),
    connectionStatus: "disconnected"
  };

  // Flush timer
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupPeriodicFlush();
    this.setupGracefulShutdown();
  }

  /**
   * Start the collector with connection management
   */
  async start(): Promise<Result<void>> {
    logger.info("Starting enhanced Jetstream collector", {
      batch_size: BATCH_SIZE,
      flush_interval: FLUSH_INTERVAL,
      jetstream_endpoint: appConfig.jetstream.endpoint
    });

    return this.connectWithRetry();
  }

  /**
   * Connect to Jetstream with circuit breaker protection
   */
  private async connectWithRetry(): Promise<Result<void>> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = "Max reconnection attempts exceeded";
      logger.error(error, { 
        attempts: this.reconnectAttempts,
        max_attempts: this.maxReconnectAttempts
      });
      return (Result.success ? undefined : (Result.error || "Unknown error"))(error);
    }

    return jetstreamBreaker.execute(async () => {
      try {
        this.stats.connectionStatus = "reconnecting";
        
        logger.info("Connecting to Jetstream", {
          attempt: this.reconnectAttempts + 1,
          max_attempts: this.maxReconnectAttempts,
          endpoint: appConfig.jetstream.endpoint
        });

        this.jetstream = new Jetstream({
          wantedCollections: [appConfig.jetstream.collection],
          endpoint: appConfig.jetstream.endpoint
        });

        this.setupEventHandlers();
        await this.jetstream.start();

        this.isRunning = true;
        this.stats.connectionStatus = "connected";
        this.reconnectAttempts = 0;

        logger.info("Jetstream connected successfully", {
          collections: [appConfig.jetstream.collection],
          endpoint: appConfig.jetstream.endpoint
        });

        return Result.success(undefined);

      } catch (error) {
        this.stats.connectionStatus = "disconnected";
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        
        logger.error("Failed to connect to Jetstream", {
          error: errorMessage,
          attempt: this.reconnectAttempts + 1,
          will_retry: this.reconnectAttempts < this.maxReconnectAttempts - 1
        });

        this.reconnectAttempts++;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.connectWithRetry(), RECONNECT_DELAY);
        }

        throw new Error(errorMessage);
      }
    });
  }

  /**
   * Setup Jetstream event handlers
   */
  private setupEventHandlers(): void {
    if (!this.jetstream) return;

    this.jetstream.on("commit", (event) => {
      this.handleCommitEvent(event);
    });

    this.jetstream.on("error", (error) => {
      this.handleConnectionError(error);
    });

    this.jetstream.on("close", () => {
      this.handleConnectionClose();
    });
  }

  /**
   * Handle commit events with error recovery
   */
  private handleCommitEvent(event: any): void {
    try {
      this.stats.totalEvents++;

      // Process based on operation type
      if (event.commit.operation === "create") {
        this.handleCreateOperation(event);
      }

    } catch (error) {
      this.stats.errors++;
      logger.warn("Error processing commit event", {
        error: error instanceof Error ? error.message : error,
        event_type: event.commit?.operation,
        collection: event.commit?.collection
      });
    }
  }

  /**
   * Handle create operations
   */
  private handleCreateOperation(event: any): void {
    const { collection, rkey, record } = event.commit;
    const authorDid = event.did;

    // Always queue the user
    this.queueUser({ did: authorDid, handle: event.identity });

    switch (collection) {
      case "app.bsky.feed.post":
        this.handlePost(event, record as PostRecord);
        break;
      case "app.bsky.feed.like":
        this.handleLike(event, record as LikeRecord);
        break;
      case "app.bsky.feed.repost":
        this.handleRepost(event, record as RepostRecord);
        break;
      case "app.bsky.graph.follow":
        this.handleFollow(event, record as FollowRecord);
        break;
      default:
        // Ignore other collections
        break;
    }
  }

  /**
   * Handle post creation
   */
  private handlePost(event: any, record: PostRecord): void {
    const post: QueuedPost = {
      uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
      cid: event.commit.cid,
      author_did: event.did,
      text: record.text || "",
      created_at: record.createdAt,
      like_count: 0,
      repost_count: 0,
      reply_count: 0
    };

    this.queuePost(post);
    this.stats.postsProcessed++;
  }

  /**
   * Handle like creation
   */
  private handleLike(event: any, record: LikeRecord): void {
    const like: QueuedLike = {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: record.subject.uri,
      subject_cid: record.subject.cid,
      created_at: record.createdAt
    };

    this.queueLike(like);
    this.stats.likesProcessed++;
  }

  /**
   * Handle repost creation
   */
  private handleRepost(event: any, record: RepostRecord): void {
    const repost: QueuedRepost = {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: record.subject.uri,
      subject_cid: record.subject.cid,
      created_at: record.createdAt
    };

    this.queueRepost(repost);
    this.stats.repostsProcessed++;
  }

  /**
   * Handle follow creation
   */
  private handleFollow(event: any, record: FollowRecord): void {
    const follow: QueuedFollow = {
      uri: `at://${event.did}/app.bsky.graph.follow/${event.commit.rkey}`,
      author_did: event.did,
      subject_did: record.subject,
      created_at: record.createdAt
    };

    this.queueFollow(follow);
    this.stats.followsProcessed++;
  }

  /**
   * Queue management methods
   */
  private queueUser(user: QueuedUser): void {
    this.userQueue.push(user);
    if (this.userQueue.length >= BATCH_SIZE) {
      this.flushUsers();
    }
  }

  private queuePost(post: QueuedPost): void {
    this.postQueue.push(post);
    if (this.postQueue.length >= BATCH_SIZE) {
      this.flushPosts();
    }
  }

  private queueLike(like: QueuedLike): void {
    this.likeQueue.push(like);
    if (this.likeQueue.length >= BATCH_SIZE) {
      this.flushLikes();
    }
  }

  private queueRepost(repost: QueuedRepost): void {
    this.repostQueue.push(repost);
    if (this.repostQueue.length >= BATCH_SIZE) {
      this.flushReposts();
    }
  }

  private queueFollow(follow: QueuedFollow): void {
    this.followQueue.push(follow);
    if (this.followQueue.length >= BATCH_SIZE) {
      this.flushFollows();
    }
  }

  /**
   * Batch database operations with circuit breaker protection
   */
  private async flushUsers(): Promise<void> {
    if (this.userQueue.length === 0) return;

    const batch = this.userQueue.splice(0);
    
    const result = await supabaseBreaker.execute(async () => {
      const { error } = await supabase
        .from("bluesky_users")
        .upsert(batch, { onConflict: "did" });

      if (error) throw error;
      return Result.success(undefined);
    });

    if (!result.success) {
      logger.error("Failed to flush users batch", {
        batch_size: batch.length,
        error: (result.success ? undefined : (result.error || "Unknown error"))
      });
    } else {
      this.stats.usersProcessed += batch.length;
      logger.debug("Users batch flushed", { count: batch.length });
    }
  }

  private async flushPosts(): Promise<void> {
    if (this.postQueue.length === 0) return;

    const batch = this.postQueue.splice(0);
    
    const result = await supabaseBreaker.execute(async () => {
      const { error } = await supabase
        .from("bluesky_posts")
        .upsert(batch, { onConflict: "uri" });

      if (error) throw error;
      return Result.success(undefined);
    });

    if (!result.success) {
      logger.error("Failed to flush posts batch", {
        batch_size: batch.length,
        error: (result.success ? undefined : (result.error || "Unknown error"))
      });
    } else {
      logger.debug("Posts batch flushed", { count: batch.length });
    }
  }

  private async flushLikes(): Promise<void> {
    if (this.likeQueue.length === 0) return;

    const batch = this.likeQueue.splice(0);
    
    const result = await supabaseBreaker.execute(async () => {
      const { error } = await supabase
        .from("bluesky_likes")
        .upsert(batch, { onConflict: "uri" });

      if (error) throw error;
      return Result.success(undefined);
    });

    if (!result.success) {
      logger.error("Failed to flush likes batch", {
        batch_size: batch.length,
        error: (result.success ? undefined : (result.error || "Unknown error"))
      });
    } else {
      logger.debug("Likes batch flushed", { count: batch.length });
    }
  }

  private async flushReposts(): Promise<void> {
    if (this.repostQueue.length === 0) return;

    const batch = this.repostQueue.splice(0);
    
    const result = await supabaseBreaker.execute(async () => {
      const { error } = await supabase
        .from("bluesky_reposts")
        .upsert(batch, { onConflict: "uri" });

      if (error) throw error;
      return Result.success(undefined);
    });

    if (!result.success) {
      logger.error("Failed to flush reposts batch", {
        batch_size: batch.length,
        error: (result.success ? undefined : (result.error || "Unknown error"))
      });
    } else {
      logger.debug("Reposts batch flushed", { count: batch.length });
    }
  }

  private async flushFollows(): Promise<void> {
    if (this.followQueue.length === 0) return;

    const batch = this.followQueue.splice(0);
    
    const result = await supabaseBreaker.execute(async () => {
      const { error } = await supabase
        .from("bluesky_follows")
        .upsert(
          batch.map(f => ({
            follower_did: f.author_did,
            following_did: f.subject_did,
            created_at: f.created_at
          })),
          { onConflict: "follower_did,following_did" }
        );

      if (error) throw error;
      return Result.success(undefined);
    });

    if (!result.success) {
      logger.error("Failed to flush follows batch", {
        batch_size: batch.length,
        error: (result.success ? undefined : (result.error || "Unknown error"))
      });
    } else {
      logger.debug("Follows batch flushed", { count: batch.length });
    }
  }

  /**
   * Flush all queues
   */
  private async flushAll(): Promise<void> {
    logger.info("Flushing all queues", {
      users: this.userQueue.length,
      posts: this.postQueue.length,
      likes: this.likeQueue.length,
      reposts: this.repostQueue.length,
      follows: this.followQueue.length
    });

    await Promise.all([
      this.flushUsers(),
      this.flushPosts(),
      this.flushLikes(),
      this.flushReposts(),
      this.flushFollows()
    ]);

    this.stats.lastFlushTime = new Date();
  }

  /**
   * Setup periodic flush
   */
  private setupPeriodicFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushAll();
    }, FLUSH_INTERVAL);
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: any): void {
    this.stats.errors++;
    this.stats.connectionStatus = "disconnected";
    
    logger.error("Jetstream connection error", {
      error: error instanceof Error ? error.message : error,
      will_reconnect: this.reconnectAttempts < this.maxReconnectAttempts
    });

    if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.connectWithRetry(), RECONNECT_DELAY);
    }
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(): void {
    this.stats.connectionStatus = "disconnected";
    logger.warn("Jetstream connection closed");

    if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.connectWithRetry(), RECONNECT_DELAY);
    }
  }

  /**
   * Get collector statistics
   */
  getStats(): CollectorStats {
    return { ...this.stats };
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      logger.info("Shutting down Jetstream collector gracefully");
      
      this.isRunning = false;
      
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      
      // Final flush
      await this.flushAll();
      
      if (this.jetstream) {
        this.jetstream.close();
      }

      logger.info("Jetstream collector shutdown complete", this.stats);
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  /**
   * Stop the collector
   */
  async stop(): Promise<void> {
    logger.info("Stopping Jetstream collector");
    
    this.isRunning = false;
    this.stats.connectionStatus = "disconnected";

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flushAll();

    if (this.jetstream) {
      this.jetstream.close();
    }

    logger.info("Jetstream collector stopped");
  }
}

// Main execution
if (require.main === module) {
  const collector = new EnhancedJetstreamCollector();
  
  collector.start().then((result) => {
    if (!result.success) {
      logger.error("Failed to start collector", { error: (result.success ? undefined : (result.error || "Unknown error")) });
      process.exit(1);
    }
    
    logger.info("Enhanced Jetstream collector started successfully");
  });
}

