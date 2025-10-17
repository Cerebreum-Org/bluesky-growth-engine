import type { BskyAgent } from '@atproto/api';
import { supabase, type BlueskyUser, type BlueskyFollow } from './supabase.js';

export async function followBack(agent: BskyAgent, limit = 20) {
  const session = agent.session;
  if (!session) throw new Error('Not authenticated');
  const profile = await agent.getProfile({ actor: session.handle });
  const followersRes = await agent.getFollowers({ actor: profile.data.did, limit });
  const followingRes = await agent.getFollows({ actor: profile.data.did, limit });

  const following = new Set((followingRes.data.follows || []).map(f => f.did));
  const toFollow = (followersRes.data.followers || []).filter(f => !following.has(f.did));

  for (const f of toFollow) {
    try {
      await agent.follow(f.did);
      console.log('Followed', f.handle);
    } catch (e) {
      console.warn('Failed to follow', f.handle, e);
    }
  }
}

export async function likeRecentMentions(agent: BskyAgent, limit = 20) {
  const notifications = await agent.listNotifications({ limit });
  for (const n of notifications.data.notifications) {
    if (n.reason === 'mention' && n.reasonSubject) {
      try {
        await agent.like(n.uri, n.cid);
        console.log('Liked mention', n.uri);
      } catch (e) {
        console.warn('Failed to like', n.uri, e);
      }
    }
  }
}

export async function collectUsers(agent: BskyAgent, options: {
  startHandle?: string;
  maxUsers?: number;
  includeFollowers?: boolean;
  includeFollowing?: boolean;
} = {}) {
  const {
    startHandle,
    maxUsers = 1000,
    includeFollowers = true,
    includeFollowing = true,
  } = options;

  const processedDids = new Set<string>();
  const processedRelationships = new Set<string>();
  let totalCollected = 0;
  let totalRelationships = 0;

  async function saveRelationship(followerDid: string, followingDid: string) {
    const relationshipKey = `${followerDid}:${followingDid}`;
    if (processedRelationships.has(relationshipKey)) return;
    processedRelationships.add(relationshipKey);

    const follow: BlueskyFollow = {
      follower_did: followerDid,
      following_did: followingDid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('bluesky_follows')
        .upsert(follow, { onConflict: 'follower_did,following_did' });

      if (error) throw error;
      totalRelationships++;
    } catch (e) {
      console.warn(`Failed to save relationship ${followerDid} -> ${followingDid}:`, e);
    }
  }

  async function saveUser(profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    labels?: unknown;
    associated?: unknown;
    viewer?: {
      muted?: boolean;
      blockedBy?: boolean;
      blocking?: string; // AT URI
      following?: string; // AT URI
      followedBy?: string; // AT URI
    };
    createdAt?: string;
  }) {
    if (processedDids.has(profile.did)) return;
    processedDids.add(profile.did);

    const user: BlueskyUser = {
      did: profile.did,
      handle: profile.handle,
      display_name: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      banner: profile.banner,
      followers_count: profile.followersCount,
      following_count: profile.followsCount,
      posts_count: profile.postsCount,
      labels: profile.labels,
      associated: profile.associated,
      viewer_muted: profile.viewer?.muted,
      viewer_blocked_by: profile.viewer?.blockedBy,
      viewer_blocking: !!profile.viewer?.blocking,
      viewer_following: !!profile.viewer?.following,
      viewer_followed_by: !!profile.viewer?.followedBy,
      created_at: profile.createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(user, { onConflict: 'did' });

      if (error) throw error;
      totalCollected++;
      console.log(`[${totalCollected}/${maxUsers}] Saved user: ${profile.handle}`);
    } catch (e) {
      console.warn('Failed to save user', profile.handle, e);
    }
  }

  async function fetchAndSaveUsers(actor: string) {
    if (totalCollected >= maxUsers) return;

    try {
      // Get the user's profile
      const profile = await agent.getProfile({ actor });
      await saveUser(profile.data);
      const actorDid = profile.data.did;

      // Get followers (follower -> actor)
      if (includeFollowers && totalCollected < maxUsers) {
        let cursor: string | undefined;
        do {
          const followersRes = await agent.getFollowers({
            actor,
            limit: 100,
            cursor,
          });

          for (const follower of followersRes.data.followers) {
            if (totalCollected >= maxUsers) break;
            await saveUser(follower);
            // Save the relationship: follower follows actor
            await saveRelationship(follower.did, actorDid);
          }

          cursor = followersRes.data.cursor;
          if (totalCollected >= maxUsers) break;
        } while (cursor);
      }

      // Get following (actor -> following)
      if (includeFollowing && totalCollected < maxUsers) {
        let cursor: string | undefined;
        do {
          const followingRes = await agent.getFollows({
            actor,
            limit: 100,
            cursor,
          });

          for (const following of followingRes.data.follows) {
            if (totalCollected >= maxUsers) break;
            await saveUser(following);
            // Save the relationship: actor follows following
            await saveRelationship(actorDid, following.did);
          }

          cursor = followingRes.data.cursor;
          if (totalCollected >= maxUsers) break;
        } while (cursor);
      }
    } catch (e) {
      console.warn('Failed to fetch users for', actor, e);
    }
  }

  // Start with the specified handle or the authenticated user
  const session = agent.session;
  if (!session) throw new Error('Not authenticated');
  const initialActor = startHandle || session.handle;
  console.log('Starting user collection from:', initialActor);
  await fetchAndSaveUsers(initialActor);

  console.log(`\nCollection complete! Saved ${totalCollected} users and ${totalRelationships} relationships to Supabase.`);
  return totalCollected;
}

/**
 * Enhanced user collection that crawls multiple degrees of separation
 * to discover more users across the Bluesky network
 */
export async function collectUsersEnhanced(agent: BskyAgent, options: {
  seedHandles?: string[];
  maxUsers?: number;
  maxDegrees?: number;
  includeFollowers?: boolean;
  includeFollowing?: boolean;
  minFollowers?: number;
  maxFollowers?: number;
  rateLimitDelay?: number;
} = {}) {
  const {
    seedHandles = [],
    maxUsers = 10000,
    maxDegrees = 3,
    includeFollowers = true,
    includeFollowing = true,
    minFollowers = 0,
    maxFollowers = Infinity,
    rateLimitDelay = 50, // ms between requests (reduced for faster collection)
  } = options;

  const processedDids = new Set<string>();
  const queuedForCrawling = new Set<string>();
  const processedRelationships = new Set<string>();
  const crawlQueue: { did: string; handle: string; degree: number }[] = [];
  let totalCollected = 0;
  let totalRelationships = 0;

  // Batch collections for faster bulk inserts
  const userBatch: BlueskyUser[] = [];
  const relationshipBatch: BlueskyFollow[] = [];
  const BATCH_SIZE = 100; // Insert 100 at a time

  // Rate limiting helper
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function flushUserBatch() {
    if (userBatch.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(userBatch, { onConflict: 'did' });
      
      if (error) throw error;
      console.log(`✓ Inserted batch of ${userBatch.length} users`);
      userBatch.length = 0; // Clear batch
    } catch (e) {
      console.warn('Failed to insert user batch:', e);
      userBatch.length = 0;
    }
  }

  async function flushRelationshipBatch() {
    if (relationshipBatch.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('bluesky_follows')
        .upsert(relationshipBatch, { onConflict: 'follower_did,following_did' });
      
      if (error) throw error;
      relationshipBatch.length = 0; // Clear batch
    } catch {
      relationshipBatch.length = 0;
    }
  }

  async function saveRelationship(followerDid: string, followingDid: string) {
    const relationshipKey = `${followerDid}:${followingDid}`;
    if (processedRelationships.has(relationshipKey)) return;
    processedRelationships.add(relationshipKey);

    const follow: BlueskyFollow = {
      follower_did: followerDid,
      following_did: followingDid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    relationshipBatch.push(follow);
    totalRelationships++;

    // Flush batch when it reaches size limit
    if (relationshipBatch.length >= BATCH_SIZE) {
      await flushRelationshipBatch();
    }
  }

  async function saveUser(profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    labels?: unknown;
    associated?: unknown;
    viewer?: {
      muted?: boolean;
      blockedBy?: boolean;
      blocking?: string; // AT URI
      following?: string; // AT URI
      followedBy?: string; // AT URI
    };
    createdAt?: string;
  }, degree: number) {
    if (processedDids.has(profile.did)) return false;
    
    // Filter by follower count if specified
    const followerCount = profile.followersCount || 0;
    if (followerCount < minFollowers || followerCount > maxFollowers) {
      return false;
    }

    processedDids.add(profile.did);

    const user: BlueskyUser = {
      did: profile.did,
      handle: profile.handle,
      display_name: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      banner: profile.banner,
      followers_count: profile.followersCount,
      following_count: profile.followsCount,
      posts_count: profile.postsCount,
      labels: profile.labels,
      associated: profile.associated,
      viewer_muted: profile.viewer?.muted,
      viewer_blocked_by: profile.viewer?.blockedBy,
      viewer_blocking: !!profile.viewer?.blocking,
      viewer_following: !!profile.viewer?.following,
      viewer_followed_by: !!profile.viewer?.followedBy,
      created_at: profile.createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    userBatch.push(user);
    totalCollected++;
    
    // Log less frequently for performance
    if (totalCollected % 50 === 0) {
      console.log(`[${totalCollected}/${maxUsers}] Collected users...`);
    }
    
    // Add to crawl queue if we haven't reached max degree
    if (degree < maxDegrees && !queuedForCrawling.has(profile.did)) {
      crawlQueue.push({ did: profile.did, handle: profile.handle, degree: degree + 1 });
      queuedForCrawling.add(profile.did);
    }

    // Flush batch when it reaches size limit
    if (userBatch.length >= BATCH_SIZE) {
      await flushUserBatch();
    }
    
    return true;
  }

  async function crawlUserConnections(did: string, handle: string, degree: number) {
    if (totalCollected >= maxUsers) return;

    try {
      console.log(`\nCrawling degree ${degree}: ${handle}`);
      
      // Get followers (follower -> did)
      if (includeFollowers && totalCollected < maxUsers) {
        let cursor: string | undefined;
        let pageCount = 0;
        const maxPages = Math.ceil(1000 / 100); // Limit to ~1000 followers per user
        
        do {
          if (pageCount >= maxPages) break;
          
          const followersRes = await agent.getFollowers({
            actor: did,
            limit: 100,
            cursor,
          });

          for (const follower of followersRes.data.followers) {
            if (totalCollected >= maxUsers) break;
            await saveUser(follower, degree);
            // Save relationship: follower follows this user
            await saveRelationship(follower.did, did);
          }

          cursor = followersRes.data.cursor;
          pageCount++;
          
          if (rateLimitDelay > 0) await delay(rateLimitDelay);
          if (totalCollected >= maxUsers) break;
        } while (cursor);
      }

      // Get following (did -> following)
      if (includeFollowing && totalCollected < maxUsers) {
        let cursor: string | undefined;
        let pageCount = 0;
        const maxPages = Math.ceil(1000 / 100); // Limit to ~1000 following per user
        
        do {
          if (pageCount >= maxPages) break;
          
          const followingRes = await agent.getFollows({
            actor: did,
            limit: 100,
            cursor,
          });

          for (const following of followingRes.data.follows) {
            if (totalCollected >= maxUsers) break;
            await saveUser(following, degree);
            // Save relationship: this user follows following
            await saveRelationship(did, following.did);
          }

          cursor = followingRes.data.cursor;
          pageCount++;
          
          if (rateLimitDelay > 0) await delay(rateLimitDelay);
          if (totalCollected >= maxUsers) break;
        } while (cursor);
      }
    } catch (e) {
      console.warn(`Failed to crawl connections for ${handle}:`, e);
    }
  }

  // Initialize with seed accounts
  const session = agent.session;
  if (!session) throw new Error('Not authenticated');
  
  const initialHandles = seedHandles.length > 0 ? seedHandles : [session.handle];
  
  for (const handle of initialHandles) {
    try {
      const profile = await agent.getProfile({ actor: handle });
      await saveUser(profile.data, 0);
      if (rateLimitDelay > 0) await delay(rateLimitDelay);
    } catch (e) {
      console.warn(`Failed to get initial profile for ${handle}:`, e);
    }
  }

  // Process crawl queue
  console.log(`\nStarting enhanced crawl with ${crawlQueue.length} seeds, max ${maxDegrees} degrees...`);
  
  while (crawlQueue.length > 0 && totalCollected < maxUsers) {
    const batch = crawlQueue.splice(0, 10); // Process in batches
    
    for (const { did, handle, degree } of batch) {
      if (totalCollected >= maxUsers) break;
      await crawlUserConnections(did, handle, degree);
    }
    
    console.log(`Queue size: ${crawlQueue.length}, Total: ${totalCollected} users, ${totalRelationships} relationships`);
  }

  // Flush any remaining batches
  console.log('\nFlushing remaining batches...');
  await flushUserBatch();
  await flushRelationshipBatch();

  console.log(`\n✓ Enhanced collection complete! Saved ${totalCollected} users and ${totalRelationships} relationships to Supabase.`);
  return totalCollected;
}

/**
 * Discover users from popular posts and trending topics
 */
export async function collectFromPopularContent(agent: BskyAgent, options: {
  maxUsers?: number;
  searchQueries?: string[];
  includeReposts?: boolean;
  minLikes?: number;
} = {}) {
  const {
    maxUsers = 5000,
    searchQueries = ['#introduction', '#newhere', '#art', '#photography', '#tech', '#politics'],
    includeReposts = true,
    minLikes = 5,
  } = options;

  const processedDids = new Set<string>();
  let totalCollected = 0;

  async function saveUser(profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    labels?: unknown;
    associated?: unknown;
    viewer?: {
      muted?: boolean;
      blockedBy?: boolean;
      blocking?: string; // AT URI
      following?: string; // AT URI
      followedBy?: string; // AT URI
    };
    createdAt?: string;
  }) {
    if (processedDids.has(profile.did) || totalCollected >= maxUsers) return;
    processedDids.add(profile.did);

    const user: BlueskyUser = {
      did: profile.did,
      handle: profile.handle,
      display_name: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      banner: profile.banner,
      followers_count: profile.followersCount,
      following_count: profile.followsCount,
      posts_count: profile.postsCount,
      labels: profile.labels,
      associated: profile.associated,
      viewer_muted: profile.viewer?.muted,
      viewer_blocked_by: profile.viewer?.blockedBy,
      viewer_blocking: !!profile.viewer?.blocking,
      viewer_following: !!profile.viewer?.following,
      viewer_followed_by: !!profile.viewer?.followedBy,
      created_at: profile.createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(user, { onConflict: 'did' });

      if (error) throw error;
      totalCollected++;
      console.log(`[${totalCollected}/${maxUsers}] From content: ${profile.handle}`);
    } catch (e) {
      console.warn('Failed to save user', profile.handle, e);
    }
  }

  for (const query of searchQueries) {
    if (totalCollected >= maxUsers) break;
    
    try {
      console.log(`\nSearching for: ${query}`);
      const searchRes = await agent.app.bsky.feed.searchPosts({
        q: query,
        limit: 100,
      });

      for (const post of searchRes.data.posts) {
        if (totalCollected >= maxUsers) break;
        
        const likeCount = post.likeCount || 0;
        if (likeCount >= minLikes) {
          // Save the post author
          await saveUser(post.author);
          
          // If including reposts, also save users who reposted
          if (includeReposts && post.repostCount && post.repostCount > 0) {
            // Note: We can't easily get repost authors from search results
            // This would require additional API calls per post
          }
        }
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.warn(`Failed to search for "${query}":`, e);
    }
  }

  console.log(`\nPopular content collection complete! Saved ${totalCollected} users.`);
  return totalCollected;
}

/**
 * Collect users from post interactions (likes, reposts, replies)
 */
export async function collectFromPostInteractions(agent: BskyAgent, options: {
  maxUsers?: number;
  sourceHandle?: string; // Handle to get posts from (defaults to authenticated user)
  postLimit?: number; // How many posts to analyze
  includeLikes?: boolean;
  includeReposts?: boolean;
  includeReplies?: boolean;
  rateLimitDelay?: number;
} = {}) {
  const {
    maxUsers = 5000,
    sourceHandle,
    postLimit = 50,
    includeLikes = true,
    includeReposts = true,
    includeReplies = true,
    rateLimitDelay = 100,
  } = options;

  const processedDids = new Set<string>();
  const userBatch: BlueskyUser[] = [];
  const BATCH_SIZE = 100;
  let totalCollected = 0;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function flushUserBatch() {
    if (userBatch.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(userBatch, { onConflict: 'did' });
      
      if (error) throw error;
      console.log(`✓ Saved batch of ${userBatch.length} users`);
      userBatch.length = 0;
    } catch (e) {
      console.warn('Failed to save user batch:', e);
      userBatch.length = 0;
    }
  }

  async function saveUser(profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    labels?: unknown;
    associated?: unknown;
    viewer?: {
      muted?: boolean;
      blockedBy?: boolean;
      blocking?: string;
      following?: string;
      followedBy?: string;
    };
    createdAt?: string;
  }) {
    if (processedDids.has(profile.did) || totalCollected >= maxUsers) return false;
    processedDids.add(profile.did);

    const user: BlueskyUser = {
      did: profile.did,
      handle: profile.handle,
      display_name: profile.displayName,
      description: profile.description,
      avatar: profile.avatar,
      banner: profile.banner,
      followers_count: profile.followersCount,
      following_count: profile.followsCount,
      posts_count: profile.postsCount,
      labels: profile.labels,
      associated: profile.associated,
      viewer_muted: profile.viewer?.muted,
      viewer_blocked_by: profile.viewer?.blockedBy,
      viewer_blocking: !!profile.viewer?.blocking,
      viewer_following: !!profile.viewer?.following,
      viewer_followed_by: !!profile.viewer?.followedBy,
      created_at: profile.createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    userBatch.push(user);
    totalCollected++;
    
    if (totalCollected % 50 === 0) {
      console.log(`[${totalCollected}/${maxUsers}] Collected from interactions...`);
    }

    if (userBatch.length >= BATCH_SIZE) {
      await flushUserBatch();
    }
    
    return true;
  }

  // Get the source actor's DID
  const session = agent.session;
  if (!session) throw new Error('Not authenticated');
  
  const actor = sourceHandle || session.handle;
  const profile = await agent.getProfile({ actor });
  const actorDid = profile.data.did;
  
  console.log(`\nCollecting users from @${actor}'s post interactions...`);

  // Get recent posts from the source user
  try {
    const feedRes = await agent.getAuthorFeed({
      actor: actorDid,
      limit: postLimit,
    });

    console.log(`Found ${feedRes.data.feed.length} posts to analyze\n`);

    // Process posts in parallel batches
    const PARALLEL_POSTS = 5;
    for (let i = 0; i < feedRes.data.feed.length; i += PARALLEL_POSTS) {
      if (totalCollected >= maxUsers) break;
      
      const batch = feedRes.data.feed.slice(i, i + PARALLEL_POSTS);
      
      await Promise.all(batch.map(async (feedItem) => {
        if (totalCollected >= maxUsers) return;
        
        const post = feedItem.post;
        console.log(`\nAnalyzing post: ${post.uri}`);

        // Process likes, reposts, and replies in parallel
        const tasks = [];

        // Collect users who liked the post
        if (includeLikes) {
          tasks.push((async () => {
            try {
              let cursor: string | undefined;
              let likesCount = 0;
              
              do {
                const likesRes = await agent.getLikes({
                  uri: post.uri,
                  limit: 100,
                  cursor,
                });

                for (const like of likesRes.data.likes) {
                  if (totalCollected >= maxUsers) break;
                  await saveUser(like.actor);
                  likesCount++;
                }

                cursor = likesRes.data.cursor;
                if (totalCollected >= maxUsers) break;
              } while (cursor);
              
              console.log(`  ✓ Collected ${likesCount} users from likes`);
            } catch (e) {
              console.warn('  ✗ Failed to get likes:', e);
            }
          })());
        }

        // Collect users who reposted
        if (includeReposts) {
          tasks.push((async () => {
            try {
              let cursor: string | undefined;
              let repostsCount = 0;
              
              do {
                const repostsRes = await agent.getRepostedBy({
                  uri: post.uri,
                  limit: 100,
                  cursor,
                });

                for (const reposter of repostsRes.data.repostedBy) {
                  if (totalCollected >= maxUsers) break;
                  await saveUser(reposter);
                  repostsCount++;
                }

                cursor = repostsRes.data.cursor;
                if (totalCollected >= maxUsers) break;
              } while (cursor);
              
              console.log(`  ✓ Collected ${repostsCount} users from reposts`);
            } catch (e) {
              console.warn('  ✗ Failed to get reposts:', e);
            }
          })());
        }

        // Collect users from replies (via post thread)
        if (includeReplies) {
          tasks.push((async () => {
            try {
              const threadRes = await agent.getPostThread({
                uri: post.uri,
                depth: 1,
              });

              let repliesCount = 0;
              if ('replies' in threadRes.data.thread && threadRes.data.thread.replies) {
                for (const reply of threadRes.data.thread.replies) {
                  if (totalCollected >= maxUsers) break;
                  if ('post' in reply && reply.post) {
                    await saveUser(reply.post.author);
                    repliesCount++;
                  }
                }
              }
              
              console.log(`  ✓ Collected ${repliesCount} users from replies`);
            } catch (e) {
              console.warn('  ✗ Failed to get replies:', e);
            }
          })());
        }

        // Wait for all interaction types to complete for this post
        await Promise.all(tasks);
      }));
    }
  } catch (e) {
    console.error('Failed to get author feed:', e);
  }

  // Flush remaining users
  await flushUserBatch();

  console.log(`\n✓ Post interactions collection complete! Saved ${totalCollected} users.`);
  return totalCollected;
}
