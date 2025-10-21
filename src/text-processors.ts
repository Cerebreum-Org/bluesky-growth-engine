/**
 * Text Processing Utilities for Enhanced Bluesky Data Collection
 * Extracts mentions, hashtags, links, and thread relationships
 */

export interface MentionData {
  handle: string;
  position: number;
  normalized: string; // without @
}

export interface HashtagData {
  hashtag: string;
  normalized: string; // lowercase, cleaned
  position: number;
}

export interface LinkData {
  url: string;
  domain: string;
  position: number;
}

export interface ThreadData {
  isReply: boolean;
  parentUri?: string;
  rootUri?: string;
  replyDepth: number;
}

export interface MediaData {
  type: 'image' | 'video' | 'external' | 'record';
  url?: string;
  cid?: string;
  alt?: string;
  dimensions?: { width: number; height: number };
  metadata?: Record<string, any>;
}

/**
 * Extract @mentions from text
 */
export function extractMentions(text: string): MentionData[] {
  if (!text) return [];
  
  const mentionRegex = /@([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?)/g;
  const mentions: MentionData[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const handle = match[1];
    mentions.push({
      handle: match[0], // includes @
      position: match.index,
      normalized: handle.toLowerCase()
    });
  }
  
  return mentions;
}

/**
 * Extract #hashtags from text
 */
export function extractHashtags(text: string): HashtagData[] {
  if (!text) return [];
  
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const hashtags: HashtagData[] = [];
  let match;
  
  while ((match = hashtagRegex.exec(text)) !== null) {
    const tag = match[1];
    hashtags.push({
      hashtag: match[0], // includes #
      position: match.index,
      normalized: tag.toLowerCase()
    });
  }
  
  return hashtags;
}

/**
 * Extract URLs from text
 */
export function extractLinks(text: string): LinkData[] {
  if (!text) return [];
  
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const links: LinkData[] = [];
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    try {
      const urlObj = new URL(url);
      links.push({
        url: url,
        domain: urlObj.hostname.replace('www.', ''),
        position: match.index
      });
    } catch (_e) {
      // Skip invalid URLs
    }
  }
  
  return links;
}

/**
 * Analyze thread structure from AT Protocol record
 */
export function analyzeThreadStructure(record: any): ThreadData {
  const result: ThreadData = {
    isReply: false,
    replyDepth: 0
  };
  
  if (record.reply) {
    result.isReply = true;
    result.parentUri = record.reply.parent?.uri;
    result.rootUri = record.reply.root?.uri;
    
    // Calculate depth if we have parent info
    if (result.parentUri === result.rootUri) {
      result.replyDepth = 1; // Direct reply to root
    } else {
      result.replyDepth = 2; // Reply to reply (could be deeper, but we'll track incrementally)
    }
  }
  
  return result;
}

/**
 * Extract media information from AT Protocol record
 */
export function extractMediaData(record: any): MediaData[] {
  const media: MediaData[] = [];
  
  if (!record.embed) return media;
  
  const embed = record.embed;
  
  // Images
  if (embed.$type === 'app.bsky.embed.images' && embed.images) {
    embed.images.forEach((img: any) => {
      media.push({
        type: 'image',
        cid: img.image?.ref?.$link || img.image?.cid,
        alt: img.alt,
        dimensions: img.aspectRatio ? {
          width: img.aspectRatio.width,
          height: img.aspectRatio.height
        } : undefined,
        metadata: {
          mimeType: img.image?.mimeType,
          size: img.image?.size
        }
      });
    });
  }
  
  // Videos
  if (embed.$type === 'app.bsky.embed.video' && embed.video) {
    media.push({
      type: 'video',
      cid: embed.video.ref?.$link || embed.video.cid,
      alt: embed.alt,
      metadata: {
        mimeType: embed.video.mimeType,
        size: embed.video.size
      }
    });
  }
  
  // External links
  if (embed.$type === 'app.bsky.embed.external' && embed.external) {
    media.push({
      type: 'external',
      url: embed.external.uri,
      metadata: {
        title: embed.external.title,
        description: embed.external.description,
        thumb: embed.external.thumb
      }
    });
  }
  
  // Record embeds (quotes, etc.)
  if (embed.$type === 'app.bsky.embed.record' && embed.record) {
    media.push({
      type: 'record',
      metadata: {
        recordUri: embed.record.uri,
        recordCid: embed.record.cid
      }
    });
  }
  
  return media;
}

/**
 * Calculate engagement score for trending
 */
export function calculateEngagementScore(
  likes: number = 0,
  reposts: number = 0,
  replies: number = 0,
  timeHours: number = 1
): number {
  // Weight different engagement types
  const likeWeight = 1;
  const repostWeight = 3; // Reposts are more valuable
  const replyWeight = 5;  // Replies are most valuable
  
  const rawScore = (likes * likeWeight) + (reposts * repostWeight) + (replies * replyWeight);
  
  // Apply time decay - fresher content gets higher scores
  const timeDecay = Math.max(0.1, 1 / Math.sqrt(timeHours + 1));
  
  return rawScore * timeDecay;
}

/**
 * Normalize handle for consistent storage
 */
export function normalizeHandle(handle: string): string {
  return handle.toLowerCase()
    .replace(/^@/, '') // Remove @ if present
    .trim();
}

/**
 * Get domain from URL safely
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

/**
 * Clean and normalize hashtag
 */
export function normalizeHashtag(hashtag: string): string {
  return hashtag.toLowerCase()
    .replace(/^#/, '') // Remove # if present
    .replace(/[^a-z0-9_]/g, '') // Remove special chars
    .trim();
}

/**
 * Extract temporal patterns from timestamp
 */
export function extractTimePatterns(timestamp: string | Date) {
  const date = new Date(timestamp);
  
  return {
    hourOfDay: date.getHours(),
    dayOfWeek: date.getDay(), // 0 = Sunday
    dayOfMonth: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear()
  };
}
