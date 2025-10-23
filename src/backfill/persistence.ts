/**
 * Database Persistence for Backfill
 * 
 * Handles batched upserts to Supabase with retry logic
 */

import { supabase } from '../supabase.js';
import { backfillConfig } from './config.js';

export class BatchManager {
  private postBatch: any[] = [];
  private likeBatch: any[] = [];
  private repostBatch: any[] = [];
  private followBatch: any[] = [];
  
  public userDids = new Set<string>();
  public existingPostUris = new Set<string>();
  public seenLikeKeys = new Set<string>();
  public seenRepostKeys = new Set<string>();

  async flushPosts(): Promise<number> {
    if (this.postBatch.length === 0) return 0;

    const uniquePosts = new Map();
    this.postBatch.forEach(post => uniquePosts.set(post.uri, post));
    const batch = Array.from(uniquePosts.values());
    this.postBatch.length = 0;

    batch.forEach(post => this.existingPostUris.add(post.uri));

    for (let attempt = 1; attempt <= backfillConfig.maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('bluesky_posts')
          .upsert(batch, { onConflict: 'uri' });

        if (error) throw error;
        return batch.length;
      } catch (e: any) {
        const isTimeout = e?.code === '57014';
        const isLastAttempt = attempt === backfillConfig.maxRetries;
        
        if (isTimeout && !isLastAttempt) {
          console.warn(`Post batch timeout, retrying (${attempt}/${backfillConfig.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else if (isLastAttempt) {
          console.warn('Failed to save post batch after retries:', e);
          return 0;
        } else {
          console.warn('Failed to save post batch:', e);
          return 0;
        }
      }
    }
    return 0;
  }

  async flushLikes(): Promise<number> {
    if (this.likeBatch.length === 0) return 0;

    const uniqueLikes = new Map();
    this.likeBatch.forEach(like => {
      const key = `${like.author_did}:${like.subject_uri}`;
      uniqueLikes.set(key, like);
    });
    const batch = Array.from(uniqueLikes.values());
    this.likeBatch.length = 0;

    for (let attempt = 1; attempt <= backfillConfig.maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('bluesky_likes')
          .upsert(batch, { onConflict: 'uri' });

        if (error) throw error;
        return batch.length;
      } catch (e: any) {
        const isTimeout = e?.code === '57014';
        const isLastAttempt = attempt === backfillConfig.maxRetries;
        
        if (isTimeout && !isLastAttempt) {
          console.warn(`Like batch timeout, retrying (${attempt}/${backfillConfig.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else if (isLastAttempt) {
          console.warn('Failed to save like batch after retries:', e);
          return 0;
        } else {
          console.warn('Failed to save like batch:', e);
          return 0;
        }
      }
    }
    return 0;
  }

  async flushReposts(): Promise<number> {
    if (this.repostBatch.length === 0) return 0;

    const uniqueReposts = new Map();
    this.repostBatch.forEach(repost => {
      const key = `${repost.author_did}:${repost.subject_uri}`;
      uniqueReposts.set(key, repost);
    });
    const batch = Array.from(uniqueReposts.values());
    this.repostBatch.length = 0;

    for (let attempt = 1; attempt <= backfillConfig.maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('bluesky_reposts')
          .upsert(batch, { onConflict: 'uri' });

        if (error) throw error;
        return batch.length;
      } catch (e: any) {
        const isTimeout = e?.code === '57014';
        const isLastAttempt = attempt === backfillConfig.maxRetries;
        
        if (isTimeout && !isLastAttempt) {
          console.warn(`Repost batch timeout, retrying (${attempt}/${backfillConfig.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else if (isLastAttempt) {
          console.warn('Failed to save repost batch after retries:', e);
          return 0;
        } else {
          console.warn('Failed to save repost batch:', e);
          return 0;
        }
      }
    }
    return 0;
  }

  async flushFollows(): Promise<number> {
    if (this.followBatch.length === 0) return 0;

    const uniqueFollows = new Map();
    this.followBatch.forEach(follow => {
      const key = `${follow.follower_did}:${follow.following_did}`;
      uniqueFollows.set(key, follow);
    });
    const batch = Array.from(uniqueFollows.values());
    this.followBatch.length = 0;

    for (let attempt = 1; attempt <= backfillConfig.maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('bluesky_follows')
          .upsert(batch, { onConflict: 'follower_did,following_did' });

        if (error) throw error;
        return batch.length;
      } catch (e: any) {
        const isTimeout = e?.code === '57014';
        const isLastAttempt = attempt === backfillConfig.maxRetries;
        
        if (isTimeout && !isLastAttempt) {
          console.warn(`Follow batch timeout, retrying (${attempt}/${backfillConfig.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else if (isLastAttempt) {
          console.warn('Failed to save follow batch after retries:', e);
          return 0;
        } else {
          console.warn('Failed to save follow batch:', e);
          return 0;
        }
      }
    }
    return 0;
  }

  addPost(post: any) {
    this.postBatch.push(post);
  }

  addLike(like: any) {
    this.likeBatch.push(like);
  }

  addRepost(repost: any) {
    this.repostBatch.push(repost);
  }

  addFollow(follow: any) {
    this.followBatch.push(follow);
  }

  shouldFlush(batchSize: number): boolean {
    return this.postBatch.length >= batchSize ||
           this.likeBatch.length >= batchSize ||
           this.repostBatch.length >= batchSize ||
           this.followBatch.length >= batchSize;
  }

  async flushAll(): Promise<{ posts: number; likes: number; reposts: number; follows: number }> {
    const [posts, likes, reposts, follows] = await Promise.all([
      this.flushPosts(),
      this.flushLikes(),
      this.flushReposts(),
      this.flushFollows(),
    ]);
    return { posts, likes, reposts, follows };
  }
}
