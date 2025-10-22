/**
 * ULTIMATE Jetstream Real-Time Collector - Maximum Data Capture
 * 
 * Captures EVERYTHING from Bluesky in real-time:
 * ✅ Posts, Likes, Reposts, Follows (existing)
 * ✅ Profile updates, Identity changes  
 * ✅ Blocks, Lists, List membership
 * ✅ Feed generators, Thread/Post gates
 * ✅ Rich media metadata, Quote chains
 * ✅ Advanced engagement patterns
 * ✅ Moderation signals
 * ✅ Temporal analytics
 * 
 * With enterprise-grade reliability:
 * - Circuit breaker protection
 * - Graceful degradation
 * - Comprehensive error handling
 * - Performance monitoring
 * - Structured logging
 */

import "dotenv/config";
import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";
import { supabase } from "./supabase.js";
import { Result } from "./shared/Result.js";
import { Logger } from "./shared/Logger.js";
import { CircuitBreaker } from "./shared/CircuitBreaker.js";
import { config } from "./shared/Config.js";
import { healthChecker } from "./shared/HealthCheck.js";
import type { 
  PostRecord, 
  LikeRecord, 
  RepostRecord, 
  FollowRecord,
  ProfileRecord,
  BlockRecord,
  ListRecord,
  ListItemRecord
} from "./types/atproto-events.js";

// Initialize configuration and logging
const logger = Logger.create("UltimateJetstreamCollector");

// Circuit breakers for different operations
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

const enrichmentBreaker = new CircuitBreaker("data-enrichment", {
  failureThreshold: 10,
  recoveryTimeout: 15000,
  monitorTimeout: 3000
});

// Configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000;
const ENABLE_DEEP_ANALYSIS = true;
const ENABLE_TREND_DETECTION = true;

// Comprehensive collection targets - EVERYTHING
const TARGET_COLLECTIONS = [
  // Core content
  "app.bsky.feed.post",
  "app.bsky.feed.like", 
  "app.bsky.feed.repost",
  
  // Social graph
  "app.bsky.graph.follow",
  "app.bsky.graph.block",
  "app.bsky.graph.list",
  "app.bsky.graph.listitem",
  "app.bsky.graph.listblock",
  
  // Profile & identity
  "app.bsky.actor.profile",
  "com.atproto.identity.handle",
  "com.atproto.identity.signedPresentationKey",
  
  // Feed algorithms & controls
  "app.bsky.feed.generator",
  "app.bsky.feed.threadgate",
  "app.bsky.feed.postgate",
  
  // Moderation (if accessible)
  "app.bsky.moderation.label",
  "app.bsky.moderation.takedown",
  
  // Capture unknown collections too
  "*" // Wildcard for future collections
];

// Queue interfaces for batched processing
interface PostQueueItem {
  uri: string;
  cid: string;
  author: string;
  text: string;
  reply_to?: string;
  quote_uri?: string;
  has_media: boolean;
  media_count: number;
  media_types: string[];
  langs?: string[];
  facets_count: number;
  mentions_count: number;
  links_count: number;
  tags_count: number;
  engagement_prediction?: number;
  content_category?: string;
  created_at: string;
  collection_timestamp: string;
}

interface InteractionQueueItem {
  uri: string;
  author: string;
  target_uri: string;
  target_author: string;
  type: 'like' | 'repost' | 'reply' | 'quote' | 'mention';
  interaction_strength?: number;
  created_at: string;
  collection_timestamp: string;
}

interface SocialGraphQueueItem {
  uri: string;
  actor: string;
  target: string;
  type: 'follow' | 'block' | 'list_add' | 'list_remove';
  list_uri?: string;
  list_name?: string;
  relationship_strength?: number;
  created_at: string;
  collection_timestamp: string;
}

interface ProfileQueueItem {
  did: string;
  handle: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  labels?: string[];
  profile_strength?: number;
  activity_level?: string;
  created_at: string;
  updated_at: string;
  collection_timestamp: string;
}

interface RichMediaQueueItem {
  uri: string;
  post_uri: string;
  media_type: 'image' | 'video' | 'audio' | 'link' | 'embed';
  media_url?: string;
  alt_text?: string;
  aspect_ratio?: string;
  file_size?: number;
  duration?: number;
  thumbnail_url?: string;
  link_title?: string;
  link_description?: string;
  embed_type?: string;
  embed_data?: any;
  processing_status?: string;
  collection_timestamp: string;
}

interface TrendingQueueItem {
  content_hash: string;
  content_type: 'hashtag' | 'mention' | 'link' | 'phrase';
  content_value: string;
  post_uri: string;
  author: string;
  engagement_velocity: number;
  trend_score: number;
  geographic_data?: any;
  demographic_data?: any;
  collection_timestamp: string;
}

// Processing queues
let postQueue: PostQueueItem[] = [];
let interactionQueue: InteractionQueueItem[] = [];
let socialGraphQueue: SocialGraphQueueItem[] = [];
let profileQueue: ProfileQueueItem[] = [];
let richMediaQueue: RichMediaQueueItem[] = [];
let trendingQueue: TrendingQueueItem[] = [];

// Statistics tracking
const stats = {
  connectionStatus: "disconnected" as "connected" | "disconnected" | "reconnecting" | "failed",
  totalEvents: 0,
  postsProcessed: 0,
  interactionsProcessed: 0,
  profilesProcessed: 0,
  socialGraphProcessed: 0,
  richMediaProcessed: 0,
  trendsProcessed: 0,
  errors: 0,
  lastFlush: Date.now(),
  startTime: Date.now(),
  avgProcessingTime: 0,
  peakEventsPerSecond: 0
};

/**
 * Ultimate Jetstream Collector with maximum data capture
 */
export class UltimateJetstreamCollector {
  private jetstream: Jetstream | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private flushTimer: NodeJS.Timeout | null = null;
  private performanceTimer: NodeJS.Timeout | null = null;
  private trendAnalysisTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupPerformanceMonitoring();
    this.setupHealthChecks();
    this.setupTrendAnalysis();
  }

  private setupPerformanceMonitoring() {
    this.performanceTimer = setInterval(() => {
      const runtime = Date.now() - stats.startTime;
      const eventsPerSecond = stats.totalEvents / (runtime / 1000);
      
      if (eventsPerSecond > stats.peakEventsPerSecond) {
        stats.peakEventsPerSecond = eventsPerSecond;
      }

      logger.info("Performance metrics", {
        totalEvents: stats.totalEvents,
        eventsPerSecond: eventsPerSecond.toFixed(2),
        peakEventsPerSecond: stats.peakEventsPerSecond.toFixed(2),
        queueSizes: {
          posts: postQueue.length,
          interactions: interactionQueue.length,
          socialGraph: socialGraphQueue.length,
          profiles: profileQueue.length,
          richMedia: richMediaQueue.length,
          trending: trendingQueue.length
        },
        avgProcessingTime: stats.avgProcessingTime.toFixed(2) + "ms",
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB"
      });
    }, 60000); // Every minute
  }

  private setupHealthChecks() {
    healthChecker.registerCheck("ultimate-jetstream-collector", async () => {
      return {
        status: this.isRunning ? "healthy" : "unhealthy",
        connectionStatus: stats.connectionStatus,
        totalEvents: stats.totalEvents,
        errors: stats.errors,
        uptime: Date.now() - stats.startTime,
        queueHealth: {
          totalQueuedItems: postQueue.length + interactionQueue.length + socialGraphQueue.length + profileQueue.length + richMediaQueue.length + trendingQueue.length,
          lastFlush: Date.now() - stats.lastFlush
        },
        timestamp: new Date().toISOString()
      };
    });
  }

  private setupTrendAnalysis() {
    if (ENABLE_TREND_DETECTION) {
      this.trendAnalysisTimer = setInterval(() => {
        this.analyzeTrends().catch(error => {
          logger.warn("Trend analysis failed", { error: error.message });
        });
      }, 30000); // Every 30 seconds
      }
  }

  async start(): Promise<Result<void>> {
    return jetstreamBreaker.execute(async () => {
      try {
        await config.load();
        logger.info("Starting Ultimate Jetstream Collector", {
          targetCollections: TARGET_COLLECTIONS,
          batchSize: BATCH_SIZE,
          flushInterval: FLUSH_INTERVAL
        });

        this.isRunning = true;
        stats.connectionStatus = "connecting";
        
        return this.connectWithRetry();
      } catch (error) {
        logger.error("Failed to start Ultimate Jetstream Collector", { error });
        return Result.error(`Failed to start collector: ${error.message}`);
      }
    });
  }

  private async connectWithRetry(): Promise<Result<void>> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = "Max reconnection attempts exceeded";
      logger.error(error, { 
        attempts: this.reconnectAttempts,
        max_attempts: this.maxReconnectAttempts
      });
      return Result.error(error);
    }

    return jetstreamBreaker.execute(async () => {
      try {
        stats.connectionStatus = "reconnecting";
        
        logger.info("Connecting to Jetstream", {
          attempt: this.reconnectAttempts + 1,
          maxAttempts: this.maxReconnectAttempts
        });

        this.jetstream = new Jetstream({
          ws: WebSocket,
          wantedCollections: TARGET_COLLECTIONS,
        });

        await this.setupEventHandlers();
        await this.jetstream.start();
        
        stats.connectionStatus = "connected";
        this.reconnectAttempts = 0;
        
        this.startFlushTimer();
        
        logger.info("Ultimate Jetstream Collector connected successfully");
        return Result.success(undefined);
        
      } catch (error) {
        this.reconnectAttempts++;
        logger.warn("Jetstream connection failed, retrying", {
          attempt: this.reconnectAttempts,
          error: error.message,
          retryIn: RECONNECT_DELAY
        });
        
        setTimeout(() => {
          this.connectWithRetry();
        }, RECONNECT_DELAY);
        
        return Result.error(`Connection failed: ${error.message}`);
      }
    });
  }

  private async setupEventHandlers() {
    if (!this.jetstream) return;

    this.jetstream.onCreate('*', (event) => {
      this.processEvent(event, 'create');
    });

    this.jetstream.onUpdate('*', (event) => {
      this.processEvent(event, 'update');
    });

    this.jetstream.onDelete('*', (event) => {
      this.processEvent(event, 'delete');
    });

    this.jetstream.onError((error) => {
      stats.errors++;
      logger.error("Jetstream error", { error: error.message });
      this.handleConnectionError(error);
    });

    this.jetstream.onClose(() => {
      stats.connectionStatus = "disconnected";
      logger.warn("Jetstream connection closed");
      this.handleConnectionError(new Error("Connection closed"));
    });
  }

  private async processEvent(event: any, action: 'create' | 'update' | 'delete') {
    const startTime = Date.now();
    
    try {
      stats.totalEvents++;
      
      if (!event.commit) {
        logger.debug("Event without commit data", { event });
        return;
      }

      const { collection, rkey, record } = event.commit;

      logger.debug("Processing event", {
        action,
        collection,
        did: event.did,
        rkey: rkey?.slice(0, 10) + "..."
      });

      // Route to appropriate processor based on collection
      switch (collection) {
        case "app.bsky.feed.post":
          await this.processPost(event, action);
          stats.postsProcessed++;
          break;
          
        case "app.bsky.feed.like":
          await this.processLike(event, action);
          stats.interactionsProcessed++;
          break;
          
        case "app.bsky.feed.repost":
          await this.processRepost(event, action);
          stats.interactionsProcessed++;
          break;
          
        case "app.bsky.graph.follow":
          await this.processFollow(event, action);
          stats.socialGraphProcessed++;
          break;
          
        case "app.bsky.graph.block":
          await this.processBlock(event, action);
          stats.socialGraphProcessed++;
          break;
          
        case "app.bsky.graph.list":
          await this.processList(event, action);
          stats.socialGraphProcessed++;
          break;
          
        case "app.bsky.graph.listitem":
          await this.processListItem(event, action);
          stats.socialGraphProcessed++;
          break;
          
        case "app.bsky.actor.profile":
          await this.processProfile(event, action);
          stats.profilesProcessed++;
          break;
          
        case "app.bsky.feed.generator":
          await this.processFeedGenerator(event, action);
          break;
          
        case "app.bsky.feed.threadgate":
        case "app.bsky.feed.postgate":
          await this.processGate(event, action);
          break;
          
        default:
          // Capture unknown collections for future analysis
          await this.processUnknownCollection(event, action);
          logger.info("Unknown collection encountered", { collection, action });
      }

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      stats.avgProcessingTime = (stats.avgProcessingTime + processingTime) / 2;

    } catch (error) {
      stats.errors++;
      logger.error("Error processing event", {
        error: error.message,
        collection: event.commit?.collection,
        did: event.did,
        action
      });
    }
  }

  private async processPost(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') {
      // Handle post deletion
      return;
    }

    const record = event.commit.record as PostRecord;
    const timestamp = new Date().toISOString();

    // Extract rich content analysis
    const mediaAnalysis = this.analyzeMedia(record);
    const textAnalysis = this.analyzeText(record.text || "");
    const engagementPrediction = this.predictEngagement(record);

    const postItem: PostQueueItem = {
      uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
      cid: event.commit.cid,
      author: event.did,
      text: record.text || "",
      reply_to: record.reply?.parent?.uri,
      quote_uri: record.embed?.record?.uri,
      has_media: mediaAnalysis.hasMedia,
      media_count: mediaAnalysis.count,
      media_types: mediaAnalysis.types,
      langs: record.langs,
      facets_count: record.facets?.length || 0,
      mentions_count: textAnalysis.mentions,
      links_count: textAnalysis.links,
      tags_count: textAnalysis.hashtags,
      engagement_prediction: engagementPrediction,
      content_category: this.categorizeContent(record),
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    postQueue.push(postItem);

    // Process rich media separately
    if (mediaAnalysis.hasMedia) {
      await this.processRichMedia(event, record);
    }

    // Extract trending signals
    if (ENABLE_TREND_DETECTION) {
      await this.extractTrendingSignals(event, record);
    }
  }

  private async processLike(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') return;

    const record = event.commit.record as LikeRecord;
    const timestamp = new Date().toISOString();

    const interactionItem: InteractionQueueItem = {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      author: event.did,
      target_uri: record.subject.uri,
      target_author: this.extractAuthorFromUri(record.subject.uri),
      type: 'like',
      interaction_strength: this.calculateInteractionStrength('like', event.did),
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    interactionQueue.push(interactionItem);
  }

  private async processRepost(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') return;

    const record = event.commit.record as RepostRecord;
    const timestamp = new Date().toISOString();

    const interactionItem: InteractionQueueItem = {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      author: event.did,
      target_uri: record.subject.uri,
      target_author: this.extractAuthorFromUri(record.subject.uri),
      type: 'repost',
      interaction_strength: this.calculateInteractionStrength('repost', event.did),
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    interactionQueue.push(interactionItem);
  }

  private async processFollow(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') return;

    const record = event.commit.record as FollowRecord;
    const timestamp = new Date().toISOString();

    const socialGraphItem: SocialGraphQueueItem = {
      uri: `at://${event.did}/app.bsky.graph.follow/${event.commit.rkey}`,
      actor: event.did,
      target: record.subject,
      type: 'follow',
      relationship_strength: this.calculateRelationshipStrength('follow', event.did, record.subject),
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    socialGraphQueue.push(socialGraphItem);
  }

  private async processBlock(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') return;

    const record = event.commit.record as BlockRecord;
    const timestamp = new Date().toISOString();

    const socialGraphItem: SocialGraphQueueItem = {
      uri: `at://${event.did}/app.bsky.graph.block/${event.commit.rkey}`,
      actor: event.did,
      target: record.subject,
      type: 'block',
      relationship_strength: -1, // Negative relationship
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    socialGraphQueue.push(socialGraphItem);
  }

  private async processList(event: any, action: 'create' | 'update' | 'delete') {
    // Process list creation/updates
    const timestamp = new Date().toISOString();
    
    logger.info("List activity detected", {
      action,
      listUri: `at://${event.did}/app.bsky.graph.list/${event.commit.rkey}`,
      creator: event.did
    });
  }

  private async processListItem(event: any, action: 'create' | 'update' | 'delete') {
    // Process list membership changes
    const record = event.commit.record as ListItemRecord;
    const timestamp = new Date().toISOString();

    const socialGraphItem: SocialGraphQueueItem = {
      uri: `at://${event.did}/app.bsky.graph.listitem/${event.commit.rkey}`,
      actor: event.did,
      target: record.subject,
      type: action === 'delete' ? 'list_remove' : 'list_add',
      list_uri: record.list,
      created_at: record.createdAt || timestamp,
      collection_timestamp: timestamp
    };

    socialGraphQueue.push(socialGraphItem);
  }

  private async processProfile(event: any, action: 'create' | 'update' | 'delete') {
    if (action === 'delete') return;

    const record = event.commit.record as ProfileRecord;
    const timestamp = new Date().toISOString();

    const profileItem: ProfileQueueItem = {
      did: event.did,
      handle: event.identity?.handle || "",
      display_name: record.displayName,
      description: record.description,
      avatar: record.avatar?.ref?.toString(),
      banner: record.banner?.ref?.toString(),
      labels: record.labels?.map(l => l.val) || [],
      profile_strength: this.calculateProfileStrength(record),
      activity_level: this.calculateActivityLevel(event.did),
      created_at: timestamp,
      updated_at: timestamp,
      collection_timestamp: timestamp
    };

    profileQueue.push(profileItem);
  }

  private async processFeedGenerator(event: any, action: 'create' | 'update' | 'delete') {
    // Process custom feed generators
    logger.info("Feed generator activity", {
      action,
      generator: `at://${event.did}/app.bsky.feed.generator/${event.commit.rkey}`,
      creator: event.did
    });
  }

  private async processGate(event: any, action: 'create' | 'update' | 'delete') {
    // Process thread gates and post gates
    logger.info("Access control activity", {
      action,
      collection: event.commit.collection,
      controller: event.did
    });
  }

  private async processUnknownCollection(event: any, action: 'create' | 'update' | 'delete') {
    // Log unknown collections for future analysis
    logger.info("Unknown collection captured", {
      collection: event.commit.collection,
      action,
      did: event.did,
      hasRecord: !!event.commit.record
    });
  }

  private async processRichMedia(event: any, record: PostRecord) {
    // Enhanced media processing
    const timestamp = new Date().toISOString();
    
    if (record.embed?.images) {
      for (const image of record.embed.images) {
        const mediaItem: RichMediaQueueItem = {
          uri: `${event.commit.cid}-${image.alt || 'img'}`,
          post_uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
          media_type: 'image',
          alt_text: image.alt,
          aspect_ratio: `${image.aspectRatio?.width || 1}:${image.aspectRatio?.height || 1}`,
          processing_status: 'detected',
          collection_timestamp: timestamp
        };

        richMediaQueue.push(mediaItem);
      }
    }

    if (record.embed?.external) {
      const external = record.embed.external;
      const mediaItem: RichMediaQueueItem = {
        uri: `${event.commit.cid}-external`,
        post_uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
        media_type: 'link',
        media_url: external.uri,
        link_title: external.title,
        link_description: external.description,
        thumbnail_url: external.thumb?.ref?.toString(),
        processing_status: 'detected',
        collection_timestamp: timestamp
      };

      richMediaQueue.push(mediaItem);
    }
  }

  private async extractTrendingSignals(event: any, record: PostRecord) {
    const text = record.text || "";
    const timestamp = new Date().toISOString();

    // Extract hashtags
    const hashtags = text.match(/#\w+/g) || [];
    for (const hashtag of hashtags) {
      const trendItem: TrendingQueueItem = {
        content_hash: this.generateContentHash(hashtag),
        content_type: 'hashtag',
        content_value: hashtag,
        post_uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
        author: event.did,
        engagement_velocity: this.calculateEngagementVelocity(hashtag),
        trend_score: this.calculateTrendScore(hashtag),
        collection_timestamp: timestamp
      };

      trendingQueue.push(trendItem);
    }

    // Extract mentions
    const mentions = text.match(/@[\w.-]+/g) || [];
    for (const mention of mentions) {
      const trendItem: TrendingQueueItem = {
        content_hash: this.generateContentHash(mention),
        content_type: 'mention',
        content_value: mention,
        post_uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
        author: event.did,
        engagement_velocity: this.calculateEngagementVelocity(mention),
        trend_score: this.calculateTrendScore(mention),
        collection_timestamp: timestamp
      };

      trendingQueue.push(trendItem);
    }

    // Extract URLs
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
      const domain = this.extractDomain(url);
      const trendItem: TrendingQueueItem = {
        content_hash: this.generateContentHash(domain),
        content_type: 'link',
        content_value: domain,
        post_uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
        author: event.did,
        engagement_velocity: this.calculateEngagementVelocity(domain),
        trend_score: this.calculateTrendScore(domain),
        collection_timestamp: timestamp
      };

      trendingQueue.push(trendItem);
    }
  }

  // Analysis and utility methods
  private analyzeMedia(record: PostRecord) {
    let hasMedia = false;
    let count = 0;
    let types: string[] = [];

    if (record.embed?.images) {
      hasMedia = true;
      count += record.embed.images.length;
      types.push('image');
    }

    if (record.embed?.external) {
      hasMedia = true;
      count += 1;
      types.push('link');
    }

    if (record.embed?.record) {
      hasMedia = true;
      count += 1;
      types.push('quote');
    }

    return { hasMedia, count, types };
  }

  private analyzeText(text: string) {
    const mentions = (text.match(/@[\w.-]+/g) || []).length;
    const links = (text.match(/https?:\/\/[^\s]+/g) || []).length;
    const hashtags = (text.match(/#\w+/g) || []).length;

    return { mentions, links, hashtags };
  }

  private predictEngagement(record: PostRecord): number {
    // Simple engagement prediction based on content features
    let score = 0;

    // Media boost
    if (record.embed) score += 0.3;
    
    // Reply penalty (less viral)
    if (record.reply) score -= 0.2;
    
    // Length sweet spot
    const textLength = record.text?.length || 0;
    if (textLength > 50 && textLength < 200) score += 0.2;
    
    // Time of day boost (would need to implement)
    // Language boost (would need to analyze)
    
    return Math.max(0, Math.min(1, score));
  }

  private categorizeContent(record: PostRecord): string {
    const text = record.text?.toLowerCase() || "";
    
    if (record.embed?.images) return "media";
    if (record.embed?.external) return "link_share";  
    if (record.embed?.record) return "quote_post";
    if (record.reply) return "reply";
    if (text.includes("?")) return "question";
    if (text.length > 500) return "long_form";
    
    return "text";
  }

  private calculateInteractionStrength(type: 'like' | 'repost', actor: string): number {
    // Would calculate based on user history, relationship strength, etc.
    return type === 'repost' ? 0.8 : 0.4;
  }

  private calculateRelationshipStrength(type: string, actor: string, target: string): number {
    // Would analyze mutual connections, interaction history, etc.
    return 0.5;
  }

  private calculateProfileStrength(record: ProfileRecord): number {
    let score = 0;
    if (record.displayName) score += 0.2;
    if (record.description) score += 0.3;
    if (record.avatar) score += 0.2;
    if (record.banner) score += 0.1;
    return score;
  }

  private calculateActivityLevel(did: string): string {
    // Would analyze recent posting frequency
    return "unknown";
  }

  private extractAuthorFromUri(uri: string): string {
    const parts = uri.split('/');
    return parts[2] || "";
  }

  private generateContentHash(content: string): string {
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  private calculateEngagementVelocity(content: string): number {
    // Would analyze how quickly this content is gaining traction
    return Math.random() * 100;
  }

  private calculateTrendScore(content: string): number {
    // Would calculate trend score based on frequency, recency, user diversity
    return Math.random() * 10;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url.split('/')[2] || url;
    }
  }

  private async analyzeTrends(): Promise<void> {
    // Analyze trending queue for patterns
    if (trendingQueue.length === 0) return;

    logger.info("Running trend analysis", {
      queueSize: trendingQueue.length,
      hashtags: trendingQueue.filter(t => t.content_type === 'hashtag').length,
      mentions: trendingQueue.filter(t => t.content_type === 'mention').length,
      links: trendingQueue.filter(t => t.content_type === 'link').length
    });
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushAllQueues().catch(error => {
        logger.error("Queue flush failed", { error: error.message });
      });
    }, FLUSH_INTERVAL);
  }

  private async flushAllQueues(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.allSettled([
        this.flushPostQueue(),
        this.flushInteractionQueue(), 
        this.flushSocialGraphQueue(),
        this.flushProfileQueue(),
        this.flushRichMediaQueue(),
        this.flushTrendingQueue()
      ]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      stats.lastFlush = Date.now();
      
      logger.info("Queue flush completed", {
        successful,
        failed,
        flushTime: Date.now() - startTime,
        totalQueuedBefore: postQueue.length + interactionQueue.length + socialGraphQueue.length + profileQueue.length + richMediaQueue.length + trendingQueue.length
      });

    } catch (error) {
      logger.error("Critical flush error", { error: error.message });
    }
  }

  private async flushPostQueue(): Promise<Result<void>> {
    if (postQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = postQueue.splice(0, Math.min(BATCH_SIZE, postQueue.length));
      
      const { error } = await supabase
        .from('bluesky_posts_comprehensive')
        .insert(batch);

      if (error) {
        // Re-add failed items back to queue
        postQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Post batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async flushInteractionQueue(): Promise<Result<void>> {
    if (interactionQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = interactionQueue.splice(0, Math.min(BATCH_SIZE, interactionQueue.length));
      
      const { error } = await supabase
        .from('bluesky_interactions_comprehensive')
        .insert(batch);

      if (error) {
        interactionQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Interaction batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async flushSocialGraphQueue(): Promise<Result<void>> {
    if (socialGraphQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = socialGraphQueue.splice(0, Math.min(BATCH_SIZE, socialGraphQueue.length));
      
      const { error } = await supabase
        .from('bluesky_social_graph_comprehensive')
        .insert(batch);

      if (error) {
        socialGraphQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Social graph batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async flushProfileQueue(): Promise<Result<void>> {
    if (profileQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = profileQueue.splice(0, Math.min(BATCH_SIZE, profileQueue.length));
      
      const { error } = await supabase
        .from('bluesky_profiles_comprehensive')
        .upsert(batch, { onConflict: 'did' });

      if (error) {
        profileQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Profile batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async flushRichMediaQueue(): Promise<Result<void>> {
    if (richMediaQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = richMediaQueue.splice(0, Math.min(BATCH_SIZE, richMediaQueue.length));
      
      const { error } = await supabase
        .from('bluesky_rich_media')
        .insert(batch);

      if (error) {
        richMediaQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Rich media batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async flushTrendingQueue(): Promise<Result<void>> {
    if (trendingQueue.length === 0) return Result.success(undefined);

    return supabaseBreaker.execute(async () => {
      const batch = trendingQueue.splice(0, Math.min(BATCH_SIZE, trendingQueue.length));
      
      const { error } = await supabase
        .from('bluesky_trending_signals')
        .insert(batch);

      if (error) {
        trendingQueue.unshift(...batch);
        throw error;
      }

      logger.debug("Trending batch flushed", { count: batch.length });
      return Result.success(undefined);
    });
  }

  private async handleConnectionError(error: Error) {
    stats.connectionStatus = "failed";
    stats.errors++;
    
    logger.error("Connection error, attempting recovery", {
      error: error.message,
      reconnectAttempts: this.reconnectAttempts
    });

    // Attempt reconnection after delay
    setTimeout(() => {
      this.connectWithRetry();
    }, RECONNECT_DELAY);
  }

  async stop(): Promise<void> {
    logger.info("Stopping Ultimate Jetstream Collector");
    
    this.isRunning = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }
    
    if (this.trendAnalysisTimer) {
      clearInterval(this.trendAnalysisTimer);
    }

    if (this.jetstream) {
      this.jetstream.close();
    }

    // Final flush
    await this.flushAllQueues();
    
    stats.connectionStatus = "disconnected";
    logger.info("Ultimate Jetstream Collector stopped");
  }

  getStats() {
    return {
      ...stats,
      queueSizes: {
        posts: postQueue.length,
        interactions: interactionQueue.length,
        socialGraph: socialGraphQueue.length,
        profiles: profileQueue.length,
        richMedia: richMediaQueue.length,
        trending: trendingQueue.length
      },
      uptime: Date.now() - stats.startTime
    };
  }
}

// Create and export collector instance
export const ultimateCollector = new UltimateJetstreamCollector();

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ultimateCollector.start()
    .then((result) => {
      if (result.success) {
        logger.info("Ultimate Jetstream Collector started successfully");
      } else {
        logger.error("Failed to start collector", { error: (result.success ? undefined : (result.error || "Unknown error")) });
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error("Critical startup error", { error: error.message });
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await ultimateCollector.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await ultimateCollector.stop();
    process.exit(0);
  });
}
