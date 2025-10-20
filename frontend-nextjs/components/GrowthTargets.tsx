'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

type BlueskyUser = Database['public']['Tables']['bluesky_users']['Row'];

interface GrowthTarget extends BlueskyUser {
  influence_score: number;
  follow_ratio: number;
  target_reason: string;
}

export function GrowthTargets() {
  const [targets, setTargets] = useState<GrowthTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'high_value' | 'influencers' | 'mutual_potential'>('high_value');

  useEffect(() => {
    async function fetchGrowthTargets() {
      try {
        const baseQuery = supabase
          .from('bluesky_users')
          .select('*')
          .gt('followers_count', 1000)
          .not('viewer_following', 'eq', true); // Not already following

        let data: BlueskyUser[] = [];
        
        if (activeTab === 'high_value') {
          // High follower/following ratio users (influencers who don't follow many people)
          const { data: rawData } = await baseQuery
            .gt('followers_count', 5000)
            .lt('following_count', 1000)
            .order('followers_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        } else if (activeTab === 'influencers') {
          // Top influencers by follower count
          const { data: rawData } = await baseQuery
            .gt('followers_count', 10000)
            .order('followers_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        } else if (activeTab === 'mutual_potential') {
          // Users who follow many people (likely to follow back)
          const { data: rawData } = await baseQuery
            .gt('following_count', 1000)
            .lt('followers_count', 50000) // Not mega-influencers
            .order('following_count', { ascending: false })
            .limit(15);
          data = rawData || [];
        }

        // Calculate growth metrics for each target
        const enrichedTargets: GrowthTarget[] = data.map(user => {
          const followersCount = user.followers_count || 0;
          const followingCount = user.following_count || 1; // Avoid division by zero
          const followRatio = followersCount / followingCount;
          
          let influenceScore = followersCount * 0.1; // Base score from followers
          let targetReason = '';

          if (activeTab === 'high_value') {
            influenceScore += followRatio * 100; // Bonus for high ratio
            targetReason = `High influence (${followRatio.toFixed(1)}x ratio)`;
          } else if (activeTab === 'influencers') {
            influenceScore = followersCount * 0.2;
            targetReason = `Major influencer (${(followersCount / 1000).toFixed(0)}K followers)`;
          } else {
            influenceScore += (followingCount / 100); // Bonus for following many
            const followbackChance = Math.min(90, (followingCount / followersCount) * 100);
            targetReason = `High followback potential (~${followbackChance.toFixed(0)}%)`;
          }

          return {
            ...user,
            influence_score: influenceScore,
            follow_ratio: followRatio,
            target_reason: targetReason
          };
        });

        // Sort by influence score
        enrichedTargets.sort((a, b) => b.influence_score - a.influence_score);
        setTargets(enrichedTargets);
      } catch (error) {
        console.error('Error fetching growth targets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGrowthTargets();
  }, [activeTab]);

  const tabs = [
    { id: 'high_value', label: 'High Value', icon: '🎯' },
    { id: 'influencers', label: 'Influencers', icon: '⭐' },
    { id: 'mutual_potential', label: 'Mutual Potential', icon: '🤝' },
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-4">Growth Targets</h2>
        
        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 dark:bg-zinc-950/50 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'high_value' | 'influencers' | 'mutual_potential')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-gray-200'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {targets.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">No targets found</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {targets.slice(0, 10).map((target) => (
              <div key={target.did} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {target.avatar ? (
                      <img
                        src={target.avatar}
                        alt={target.handle}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {target.handle[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://bsky.app/profile/${target.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {target.display_name || target.handle}
                        </a>
                        {target.follow_ratio > 50 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            High Ratio
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        @{target.handle}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {target.target_reason}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {(target.followers_count || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">followers</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Score: {target.influence_score.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <div className="mb-1">
            <strong>Strategy:</strong> {' '}
            {activeTab === 'high_value' && 'Target users with high follower-to-following ratios for maximum reach'}
            {activeTab === 'influencers' && 'Engage with major influencers to increase visibility'}
            {activeTab === 'mutual_potential' && 'Follow users likely to follow back for mutual connections'}
          </div>
          <div>
            💡 Click usernames to view profiles on Bluesky
          </div>
        </div>
      </div>
    </div>
  );
}