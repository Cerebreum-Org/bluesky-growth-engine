'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalUsers: number;
  totalFollows: number;
  avgFollowers: number;
  topUser: { handle: string; followers: number } | null;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalFollows: 0,
    avgFollowers: 0,
    topUser: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Run all queries in parallel for better performance
        const [
          userCountResult,
          followCountResult,
          topUserResult,
          totalFollowersResult,
        ] = await Promise.all([
          // Get total users count
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }),
          
          // Get total follows count
          supabase.from('bluesky_follows').select('*', { count: 'exact', head: true }),
          
          // Get top user by followers
          supabase
            .from('bluesky_users')
            .select('handle, followers_count')
            .order('followers_count', { ascending: false })
            .limit(1)
            .single(),
          
          // Get sum of all followers for average calculation
          // Using RPC or aggregate would be better, but we'll sample instead
          supabase
            .from('bluesky_users')
            .select('followers_count')
            .order('followers_count', { ascending: false })
            .limit(1000) // Sample top 1000 users for quick average
        ]);

        const userCount = userCountResult.count || 0;
        const followCount = followCountResult.count || 0;
        
        // Calculate average from sample
        const sampleData = totalFollowersResult.data as Array<{ followers_count?: number | null }> | null;
        const avg = sampleData && sampleData.length > 0
          ? Math.round(
              sampleData.reduce((sum, u) => sum + (u?.followers_count || 0), 0) /
                sampleData.length
            )
          : 0;
        
        const typedTopUser = topUserResult.data as { handle: string; followers_count?: number | null } | null;

        setStats({
          totalUsers: userCount || 0,
          totalFollows: followCount || 0,
          avgFollowers: avg,
          topUser: typedTopUser
            ? { handle: typedTopUser.handle, followers: typedTopUser.followers_count || 0 }
            : null,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: '👥',
    },
    {
      label: 'Total Relationships',
      value: stats.totalFollows.toLocaleString(),
      icon: '🔗',
    },
    {
      label: 'Avg Followers',
      value: stats.avgFollowers.toLocaleString(),
      icon: '📊',
    },
    {
      label: 'Top User',
      value: stats.topUser ? `@${stats.topUser.handle.split('.')[0]}` : 'N/A',
      subtitle: stats.topUser ? `${stats.topUser.followers.toLocaleString()} followers` : undefined,
      icon: '⭐',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md dark:hover:shadow-lg dark:border dark:border-zinc-800 transition-all duration-200 p-6"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">{card.label}</p>
            <span className="text-2xl">{card.icon}</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100">{card.value}</p>
            {card.subtitle && (
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">{card.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
