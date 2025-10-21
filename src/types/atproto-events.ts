/**
 * AT Protocol Event Types for Comprehensive Data Collection
 * 
 * Complete type definitions for all AT Protocol collections we capture
 */

// Base record interface
export interface BaseRecord {
  $type: string;
  createdAt?: string;
  [key: string]: any;
}

// =====================================================
// CORE CONTENT TYPES
// =====================================================

export interface PostRecord extends BaseRecord {
  $type: 'app.bsky.feed.post';
  text?: string;
  langs?: string[];
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
  embed?: {
    images?: Array<{
      image: { ref: any };
      alt?: string;
      aspectRatio?: { width: number; height: number };
    }>;
    external?: {
      uri: string;
      title?: string;
      description?: string;
      thumb?: { ref: any };
    };
    record?: {
      uri: string;
      cid: string;
    };
    media?: any;
    recordWithMedia?: any;
  };
  facets?: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{
      $type: string;
      uri?: string;
      did?: string;
      tag?: string;
    }>;
  }>;
  tags?: string[];
}

export interface LikeRecord extends BaseRecord {
  $type: 'app.bsky.feed.like';
  subject: {
    uri: string;
    cid: string;
  };
}

export interface RepostRecord extends BaseRecord {
  $type: 'app.bsky.feed.repost';
  subject: {
    uri: string;
    cid: string;
  };
}

// =====================================================
// SOCIAL GRAPH TYPES
// =====================================================

export interface FollowRecord extends BaseRecord {
  $type: 'app.bsky.graph.follow';
  subject: string; // DID
}

export interface BlockRecord extends BaseRecord {
  $type: 'app.bsky.graph.block';
  subject: string; // DID
}

export interface ListRecord extends BaseRecord {
  $type: 'app.bsky.graph.list';
  purpose: 'app.bsky.graph.defs#modlist' | 'app.bsky.graph.defs#curatelist' | string;
  name: string;
  description?: string;
  descriptionFacets?: any[];
  avatar?: { ref: any };
  labels?: Array<{
    val: string;
    neg?: boolean;
    src?: string;
    cts?: string;
    exp?: string;
  }>;
}

export interface ListItemRecord extends BaseRecord {
  $type: 'app.bsky.graph.listitem';
  subject: string; // DID
  list: string; // List URI
}

export interface ListBlockRecord extends BaseRecord {
  $type: 'app.bsky.graph.listblock';
  subject: string; // List URI
}

// =====================================================
// PROFILE & IDENTITY TYPES
// =====================================================

export interface ProfileRecord extends BaseRecord {
  $type: 'app.bsky.actor.profile';
  displayName?: string;
  description?: string;
  avatar?: { ref: any };
  banner?: { ref: any };
  labels?: Array<{
    val: string;
    neg?: boolean;
    src?: string;
    cts?: string;
    exp?: string;
  }>;
  joinedViaStarterPack?: {
    uri: string;
    cid: string;
  };
}

export interface HandleRecord extends BaseRecord {
  $type: 'com.atproto.identity.handle';
  handle: string;
}

export interface SignedPresentationKeyRecord extends BaseRecord {
  $type: 'com.atproto.identity.signedPresentationKey';
  keyId: string;
  publicKeyMultibase: string;
}

// =====================================================
// FEED GENERATION & CONTROLS
// =====================================================

export interface FeedGeneratorRecord extends BaseRecord {
  $type: 'app.bsky.feed.generator';
  did: string;
  displayName: string;
  description?: string;
  descriptionFacets?: any[];
  avatar?: { ref: any };
  acceptsInteractions?: boolean;
  labels?: Array<{
    val: string;
    neg?: boolean;
    src?: string;
    cts?: string;
    exp?: string;
  }>;
}

export interface ThreadgateRecord extends BaseRecord {
  $type: 'app.bsky.feed.threadgate';
  post: string; // Post URI
  allow?: Array<{
    $type: string;
    list?: string;
  }>;
  createdAt: string;
}

export interface PostgateRecord extends BaseRecord {
  $type: 'app.bsky.feed.postgate';
  post: string; // Post URI
  detachedEmbeds?: Array<{
    uri: string;
  }>;
  embeddingRules?: Array<{
    $type: string;
    allow?: Array<{
      $type: string;
      list?: string;
    }>;
  }>;
}

// =====================================================
// MODERATION TYPES
// =====================================================

export interface LabelRecord extends BaseRecord {
  $type: 'app.bsky.moderation.label';
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  src: string;
  cts: string;
  exp?: string;
}

export interface TakedownRecord extends BaseRecord {
  $type: 'app.bsky.moderation.takedown';
  subject: {
    uri: string;
    cid?: string;
  };
  takedownRef: string;
}

// =====================================================
// STARTER PACKS
// =====================================================

export interface StarterPackRecord extends BaseRecord {
  $type: 'app.bsky.graph.starterpack';
  name: string;
  description?: string;
  descriptionFacets?: any[];
  list: string; // List URI
  feeds?: Array<{
    uri: string;
  }>;
  joinedWeekCount?: number;
  joinedAllTimeCount?: number;
  labels?: Array<{
    val: string;
    neg?: boolean;
    src?: string;
    cts?: string;
    exp?: string;
  }>;
  indexedAt?: string;
}

// =====================================================
// CHAT & MESSAGING (when available)
// =====================================================

export interface ChatDeclarationRecord extends BaseRecord {
  $type: 'chat.bsky.actor.declaration';
  allowIncoming: 'all' | 'none' | 'following';
}

export interface ChatMessageRecord extends BaseRecord {
  $type: 'chat.bsky.convo.message';
  text?: string;
  facets?: any[];
  embed?: any;
}

// =====================================================
// LABELER SERVICES
// =====================================================

export interface LabelerRecord extends BaseRecord {
  $type: 'app.bsky.labeler.service';
  policies: {
    labelValues: string[];
    labelValueDefinitions?: Array<{
      identifier: string;
      severity: 'inform' | 'alert' | 'hide';
      blurs: 'content' | 'media' | 'none';
      defaultSetting?: 'ignore' | 'warn' | 'hide';
      adultOnly?: boolean;
      locales?: Array<{
        lang: string;
        name: string;
        description: string;
      }>;
    }>;
  };
  createdAt: string;
}

// =====================================================
// UNION TYPES FOR EVENT PROCESSING
// =====================================================

export type ContentRecord = PostRecord | LikeRecord | RepostRecord;

export type SocialGraphRecord = FollowRecord | BlockRecord | ListRecord | ListItemRecord | ListBlockRecord;

export type ProfileRecord_Union = ProfileRecord | HandleRecord | SignedPresentationKeyRecord;

export type FeedControlRecord = FeedGeneratorRecord | ThreadgateRecord | PostgateRecord;

export type ModerationRecord = LabelRecord | TakedownRecord;

export type AllATProtoRecord = 
  | ContentRecord 
  | SocialGraphRecord 
  | ProfileRecord_Union 
  | FeedControlRecord 
  | ModerationRecord
  | StarterPackRecord
  | ChatDeclarationRecord
  | ChatMessageRecord
  | LabelerRecord;

// =====================================================
// EVENT WRAPPER INTERFACES
// =====================================================

export interface ATProtoEvent {
  did: string;
  time_us: number;
  kind: 'commit' | 'identity' | 'account' | 'handle';
  commit?: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record: AllATProtoRecord | null;
    cid: string | null;
  };
  identity?: {
    did: string;
    handle?: string;
    seq: number;
    time: string;
  };
  account?: {
    did: string;
    seq: number;
    time: string;
    active: boolean;
    status?: 'takendown' | 'suspended' | 'deleted' | 'deactivated';
  };
  handle?: {
    did: string;
    handle: string;
    seq: number;
    time: string;
  };
}

export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: 'commit';
  commit: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record: any;
    cid: string;
  };
}

// =====================================================
// COLLECTION CONSTANTS
// =====================================================

export const AT_PROTO_COLLECTIONS = {
  // Core content
  POST: 'app.bsky.feed.post',
  LIKE: 'app.bsky.feed.like',
  REPOST: 'app.bsky.feed.repost',
  
  // Social graph
  FOLLOW: 'app.bsky.graph.follow',
  BLOCK: 'app.bsky.graph.block',
  LIST: 'app.bsky.graph.list',
  LIST_ITEM: 'app.bsky.graph.listitem',
  LIST_BLOCK: 'app.bsky.graph.listblock',
  STARTER_PACK: 'app.bsky.graph.starterpack',
  
  // Profile & identity
  PROFILE: 'app.bsky.actor.profile',
  HANDLE: 'com.atproto.identity.handle',
  SIGNED_PRESENTATION_KEY: 'com.atproto.identity.signedPresentationKey',
  
  // Feed controls
  FEED_GENERATOR: 'app.bsky.feed.generator',
  THREADGATE: 'app.bsky.feed.threadgate',
  POSTGATE: 'app.bsky.feed.postgate',
  
  // Moderation
  LABEL: 'app.bsky.moderation.label',
  TAKEDOWN: 'app.bsky.moderation.takedown',
  
  // Labeler services
  LABELER_SERVICE: 'app.bsky.labeler.service',
  
  // Chat (when available)
  CHAT_DECLARATION: 'chat.bsky.actor.declaration',
  CHAT_MESSAGE: 'chat.bsky.convo.message',
} as const;

export type ATProtoCollection = typeof AT_PROTO_COLLECTIONS[keyof typeof AT_PROTO_COLLECTIONS];

// =====================================================
// TYPE GUARDS
// =====================================================

export function isPostRecord(record: any): record is PostRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.POST;
}

export function isLikeRecord(record: any): record is LikeRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.LIKE;
}

export function isRepostRecord(record: any): record is RepostRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.REPOST;
}

export function isFollowRecord(record: any): record is FollowRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.FOLLOW;
}

export function isBlockRecord(record: any): record is BlockRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.BLOCK;
}

export function isProfileRecord(record: any): record is ProfileRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.PROFILE;
}

export function isListRecord(record: any): record is ListRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.LIST;
}

export function isListItemRecord(record: any): record is ListItemRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.LIST_ITEM;
}

export function isFeedGeneratorRecord(record: any): record is FeedGeneratorRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.FEED_GENERATOR;
}

export function isThreadgateRecord(record: any): record is ThreadgateRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.THREADGATE;
}

export function isPostgateRecord(record: any): record is PostgateRecord {
  return record?.$type === AT_PROTO_COLLECTIONS.POSTGATE;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface CollectionStats {
  collection: string;
  total_events: number;
  creates: number;
  updates: number;
  deletes: number;
  last_seen: string;
  avg_events_per_hour: number;
}

export interface ProcessingMetrics {
  events_processed: number;
  events_per_second: number;
  errors: number;
  last_processed: string;
  processing_lag_ms: number;
  queue_size: number;
}

export interface DataQualityMetrics {
  completeness_score: number;
  validation_errors: number;
  duplicate_rate: number;
  missing_fields: string[];
  anomaly_count: number;
}
