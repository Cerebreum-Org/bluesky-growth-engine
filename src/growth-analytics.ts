import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// ========================================
// TYPES
// ========================================

export interface TrendingAccount {
  did: string;
  handle: string;
  display_name: string | null;
  avatar: string | null;
  description: string | null;
  followers_count: number;
  followers_gained_24h: number;
  growth_percentage_24h: number;
  current_snapshot: string;
  previous_snapshot: string;
}

export interface TopPost {
  uri: string;
  text: string;
  author_did: string;
  author_handle: string;
  author_name: string | null;
  author_avatar: string | null;
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count: number;
  engagement_score: number;
  embed_type: string | null;
  created_at: string;
}

export interface UserGrowthHistory {
  snapshot_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  followers_change: number;
  growth_rate: number;
}

export interface FeedStats {
  total_posts_24h: number;
  total_engagement_24h: number;
  avg_engagement_per_post: number;
  top_content_types: Array<{
    embed_type: string;
    count: number;
    percentage: number;
  }>;
}

// ========================================
// TRENDING ACCOUNTS
// ========================================

/**
 * Get trending accounts (most followers gained in 24h)
 */
export async function getTrendingAccounts(limit: number = 50): Promise<TrendingAccount[]> {
  const { data, error } = await supabase
    .from('trending_accounts')
    .select('*')
    .order('followers_gained_24h', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trending accounts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get fastest growing accounts (highest % growth in 24h)
 */
export async function getFastestGrowingAccounts(limit: number = 50): Promise<TrendingAccount[]> {
  const { data, error } = await supabase
    .from('fastest_growing_accounts')
    .select('*')
    .order('growth_percentage_24h', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching fastest growing accounts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get most followed users
 */
export async function getMostFollowedUsers(limit: number = 100): Promise<any[]> {
  const { data, error } = await supabase
    .from('most_followed_users')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching most followed users:', error);
    throw error;
  }

  return data || [];
}

// ========================================
// TOP CONTENT
// ========================================

/**
 * Get top posts by engagement (last 24h)
 */
export async function getTopPosts24h(limit: number = 50): Promise<TopPost[]> {
  const { data, error } = await supabase
    .from('top_posts_24h')
    .select('*')
    .order('engagement_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top posts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get top videos by engagement
 */
export async function getTopVideos(limit: number = 50): Promise<TopPost[]> {
  const { data, error } = await supabase
    .from('top_videos')
    .select('*')
    .order('engagement_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top videos:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get top posts by specific embed type
 */
export async function getTopPostsByType(
  embedType: string,
  limit: number = 50,
  hours: number = 24
): Promise<TopPost[]> {
  const { data, error } = await supabase
    .from('bluesky_posts')
    .select(`
      uri,
      text,
      author_did,
      like_count,
      repost_count,
      reply_count,
      quote_count,
      embed_type,
      embed_images,
      embed_external,
      created_at,
      bluesky_users!inner(handle, display_name, avatar)
    `)
    .eq('embed_type', embedType)
    .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('like_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top posts by type:', error);
    throw error;
  }

  return (data || []).map(post => ({
    uri: post.uri,
    text: post.text,
    author_did: post.author_did,
    author_handle: (post.bluesky_users as any).handle,
    author_name: (post.bluesky_users as any).display_name,
    author_avatar: (post.bluesky_users as any).avatar,
    like_count: post.like_count,
    repost_count: post.repost_count,
    reply_count: post.reply_count,
    quote_count: post.quote_count,
    engagement_score: post.like_count + post.repost_count * 2 + post.reply_count * 3 + post.quote_count * 2,
    embed_type: post.embed_type,
    created_at: post.created_at
  }));
}

// ========================================
// USER INSIGHTS
// ========================================

/**
 * Get user growth history
 */
export async function getUserGrowthHistory(
  did: string,
  daysBack: number = 30
): Promise<UserGrowthHistory[]> {
  const { data, error } = await supabase.rpc('get_user_growth_history', {
    user_did: did,
    days_back: daysBack
  });

  if (error) {
    console.error('Error fetching user growth history:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get user profile insights
 */
export async function getUserInsights(handle: string): Promise<any> {
  // Get user basic info
  const { data: user, error: userError } = await supabase
    .from('bluesky_users')
    .select('*')
    .eq('handle', handle)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError);
    throw userError;
  }

  if (!user) {
    throw new Error('User not found');
  }

  // Get growth history
  const growthHistory = await getUserGrowthHistory(user.did, 30);

  // Get user's posts stats
  const { data: postStats } = await supabase
    .from('bluesky_posts')
    .select('like_count, repost_count, reply_count, quote_count')
    .eq('author_did', user.did);

  const totalEngagement = (postStats || []).reduce((sum, post) => 
    sum + post.like_count + post.repost_count + post.reply_count + post.quote_count, 0
  );

  const avgEngagement = postStats && postStats.length > 0 
    ? totalEngagement / postStats.length 
    : 0;

  return {
    user,
    growth_history: growthHistory,
    post_count: postStats?.length || 0,
    total_engagement: totalEngagement,
    avg_engagement_per_post: Math.round(avgEngagement * 100) / 100
  };
}

// ========================================
// FEED STATISTICS
// ========================================

/**
 * Get feed statistics (last 24h)
 */
export async function getFeedStats(): Promise<FeedStats> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Total posts in last 24h
  const { count: totalPosts } = await supabase
    .from('bluesky_posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twentyFourHoursAgo);

  // Get engagement stats
  const { data: engagementData } = await supabase
    .from('bluesky_posts')
    .select('like_count, repost_count, reply_count, quote_count')
    .gte('created_at', twentyFourHoursAgo);

  const totalEngagement = (engagementData || []).reduce((sum, post) => 
    sum + post.like_count + post.repost_count + post.reply_count + post.quote_count, 0
  );

  // Content type distribution
  const { data: contentTypes } = await supabase
    .from('bluesky_posts')
    .select('embed_type')
    .gte('created_at', twentyFourHoursAgo);

  const typeCount: Record<string, number> = {};
  (contentTypes || []).forEach(post => {
    const type = post.embed_type || 'text';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  const topContentTypes = Object.entries(typeCount)
    .map(([type, count]) => ({
      embed_type: type,
      count,
      percentage: Math.round((count / (totalPosts || 1)) * 10000) / 100
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total_posts_24h: totalPosts || 0,
    total_engagement_24h: totalEngagement,
    avg_engagement_per_post: totalPosts ? Math.round((totalEngagement / totalPosts) * 100) / 100 : 0,
    top_content_types: topContentTypes
  };
}

/**
 * Get network growth stats
 */
export async function getNetworkGrowthStats(): Promise<any> {
  // Get current user count
  const { count: totalUsers } = await supabase
    .from('bluesky_users')
    .select('*', { count: 'exact', head: true });

  // Get user growth from snapshots
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dayGrowth } = await supabase
    .from('user_snapshots')
    .select('did')
    .gte('snapshot_at', oneDayAgo)
    .lt('snapshot_at', new Date().toISOString());

  const { data: weekGrowth } = await supabase
    .from('user_snapshots')
    .select('did')
    .gte('snapshot_at', oneWeekAgo)
    .lt('snapshot_at', oneDayAgo);

  return {
    total_users: totalUsers || 0,
    new_users_24h: dayGrowth ? new Set(dayGrowth.map(s => s.did)).size : 0,
    new_users_7d: weekGrowth ? new Set(weekGrowth.map(s => s.did)).size : 0
  };
}

// ========================================
// EXPORT ALL
// ========================================

export const GrowthAnalytics = {
  getTrendingAccounts,
  getFastestGrowingAccounts,
  getMostFollowedUsers,
  getTopPosts24h,
  getTopVideos,
  getTopPostsByType,
  getUserGrowthHistory,
  getUserInsights,
  getFeedStats,
  getNetworkGrowthStats,
  getGrowthVelocity,
  getEngagementLeaders,
  getNetworkStats
};

export default GrowthAnalytics;

/**
 * Get growth velocity data (users with fastest follower growth)
 */
export async function getGrowthVelocity(limit: number = 20): Promise<TrendingAccount[]> {
  return getFastestGrowingAccounts(limit);
}

/**
 * Get engagement leaders (users with highest engagement rates)
 */
export async function getEngagementLeaders(limit: number = 20): Promise<any[]> {
  // Get users with highest engagement based on posts and interactions
  const { data, error } = await supabase
    .from('bluesky_users')
    .select(`
      did,
      handle,
      display_name,
      avatar,
      description,
      followers_count,
      following_count,
      posts_count
    `)
    .order('followers_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting engagement leaders:', error);
    return [];
  }

  return data || [];
}

/**
 * Get network statistics
 */
export async function getNetworkStats(): Promise<{ totalUsers: number; totalFollows: number }> {
  // Get total users
  const { count: totalUsers } = await supabase
    .from('bluesky_users')
    .select('*', { count: 'exact', head: true });

  // Get total follows  
  const { count: totalFollows } = await supabase
    .from('bluesky_follows')
    .select('*', { count: 'exact', head: true });

  return {
    totalUsers: totalUsers || 0,
    totalFollows: totalFollows || 0
  };
}
