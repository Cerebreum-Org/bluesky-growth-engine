'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

type BlueskyUser = Database['public']['Tables']['bluesky_users']['Row'];

interface PowerUser extends BlueskyUser {
  power_score: number;
  engagement_ratio: number;
  category: 'mega_influencer' | 'macro_influencer' | 'micro_influencer' | 'content_creator';
}

export function PowerUsers() {
  const [powerUsers, setPowerUsers] = useState<PowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'influence' | 'engagement' | 'potential'>('influence');

  useEffect(() => {
    async function fetchPowerUsers() {
      try {
        const baseQuery = supabase
          .from('bluesky_users')
          .select('*')
          .gt('followers_count', 500);

        let data: BlueskyUser[] = [];
        
        if (viewMode === 'influence') {
          // Sort by follower count (influence)
          const { data: rawData } = await baseQuery
            .order('followers_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        } else if (viewMode === 'engagement') {
          // Sort by posts count (activity)
          const { data: rawData } = await baseQuery
            .gt('posts_count', 10)
            .order('posts_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        } else {
          // Growth potential - good engagement but still growing
          const { data: rawData } = await baseQuery
            .lt('followers_count', 10000)
            .gt('posts_count', 50)
            .order('followers_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        }

        // Calculate power metrics for each user
        const enrichedUsers: PowerUser[] = data.map(user => {
          const followers = user.followers_count || 0;
          const following = user.following_count || 0;
          const posts = user.posts_count || 0;
          
          // Power score calculation
          let powerScore = 0;
          let category: PowerUser['category'] = 'content_creator';
          
          if (viewMode === 'influence') {
            powerScore = followers * 0.1 + (followers / Math.max(following, 1)) * 10;
            if (followers > 100000) category = 'mega_influencer';
            else if (followers > 10000) category = 'macro_influencer';
            else if (followers > 1000) category = 'micro_influencer';
          } else if (viewMode === 'engagement') {
            powerScore = posts * 10 + followers * 0.05;
            category = 'content_creator';
          } else {
            powerScore = (followers * 0.1) + (posts * 5) + ((followers / Math.max(following, 1)) * 5);
            category = 'content_creator';
          }

          const engagementRatio = posts > 0 ? followers / posts : 0;

          return {
            ...user,
            power_score: powerScore,
            engagement_ratio: engagementRatio,
            category
          };
        });

        // Sort by power score
        enrichedUsers.sort((a, b) => b.power_score - a.power_score);
        setPowerUsers(enrichedUsers);
      } catch (error) {
        console.error('Error fetching power users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPowerUsers();
  }, [viewMode]);

  const getCategoryColor = (category: PowerUser['category']) => {
    switch (category) {
      case 'mega_influencer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      case 'macro_influencer':
        return 'bg-blue-100 text-blue-800 dark:bg-indigo-900/40 dark:text-indigo-300';
      case 'micro_influencer':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      default:
        return 'bg-orange-100 text-orange-800 dark:bg-amber-900/40 dark:text-amber-300';
    }
  };

  const getCategoryLabel = (category: PowerUser['category']) => {
    switch (category) {
      case 'mega_influencer': return 'Mega';
      case 'macro_influencer': return 'Macro';
      case 'micro_influencer': return 'Micro';
      default: return 'Creator';
    }
  };

  const modes = [
    { id: 'influence', label: 'Influence', icon: '👑' },
    { id: 'engagement', label: 'Activity', icon: '📢' },
    { id: 'potential', label: 'Growth', icon: '📈' },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-slate-200 dark:bg-zinc-800 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
                <div className="h-2 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-4">Power Users</h2>
        
        {/* Mode Selector */}
        <div className="flex space-x-1 bg-slate-100 dark:bg-zinc-900 rounded-lg p-1 border border-slate-200 dark:border-zinc-800">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as 'influence' | 'engagement' | 'potential')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === mode.id
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100'
              }`}
            >
              <span className="mr-1">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {powerUsers.length === 0 ? (
          <p className="text-slate-500 dark:text-zinc-400 text-center py-8">No power users found</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {powerUsers.map((user, index) => (
              <div key={user.did} className="p-4 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-bold">
                      #{index + 1}
                    </div>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.handle}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {user.handle[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://bsky.app/profile/${user.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-indigo-400"
                        >
                          {user.display_name || user.handle}
                        </a>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(user.category)}`}>
                          {getCategoryLabel(user.category)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-zinc-400">
                        @{user.handle}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        <span>{(user.followers_count || 0).toLocaleString()} followers</span>
                        <span>{(user.posts_count || 0).toLocaleString()} posts</span>
                        {viewMode === 'engagement' && user.engagement_ratio > 0 && (
                          <span>{user.engagement_ratio.toFixed(0)} followers/post</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-indigo-400">
                      {user.power_score.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">power score</div>
                    {user.viewer_following && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">Following</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50">
        <div className="text-xs text-slate-600 dark:text-zinc-400">
          <div className="mb-1">
            <strong>Analysis:</strong> {' '}
            {viewMode === 'influence' && `Ranked by follower count and influence ratio`}
            {viewMode === 'engagement' && `Ranked by posting activity and content creation`}
            {viewMode === 'potential' && `Ranked by growth potential and engagement metrics`}
          </div>
          <div className="flex items-center justify-between">
            <span>💡 Click usernames to view Bluesky profiles</span>
            <span className="text-slate-500">
              Showing top {Math.min(powerUsers.length, 15)} users
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}