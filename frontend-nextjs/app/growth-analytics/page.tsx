'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/DashboardHeader';

interface TrendingAccount {
  did: string;
  handle: string;
  display_name: string | null;
  followers_count: number;
  followers_gained_24h: number;
  growth_percentage_24h: number;
}

interface DashboardData {
  trending: TrendingAccount[];
  fastest_growing: TrendingAccount[];
  most_followed: TrendingAccount[];
  top_posts: any[];
  feed_stats: {
    total_posts_24h: number;
    total_engagement_24h: number;
    avg_engagement_per_post: number;
  };
  network_stats: {
    total_users: number;
    new_users_24h: number;
  };
}

const API_BASE = 'http://100.69.129.86:3003';

export default function GrowthAnalytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
        <div className="container mx-auto px-4 py-8">
          <DashboardHeader />
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
        <div className="container mx-auto px-4 py-8">
          <DashboardHeader />
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
              <p className="text-gray-600 dark:text-gray-300">{error}</p>
              <button
                onClick={fetchDashboardData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <DashboardHeader />

        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Total Users</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.network_stats.total_users.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">New Users (24h)</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                +{data.network_stats.new_users_24h.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Posts (24h)</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.feed_stats.total_posts_24h.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Avg Engagement</h3>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {data.feed_stats.avg_engagement_per_post.toFixed(1)}
              </p>
            </motion.div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Trending Accounts */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">🔥 Trending (24h Followers)</h2>
              <div className="space-y-3">
                {data.trending.slice(0, 10).map((user, index) => (
                  <div key={user.did} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-sm w-6">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{user.display_name || user.handle}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">@{user.handle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 dark:text-green-400">+{user.followers_gained_24h.toLocaleString()}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{user.followers_count.toLocaleString()} total</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Fastest Growing */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">🚀 Fastest Growing (% Growth)</h2>
              <div className="space-y-3">
                {data.fastest_growing.slice(0, 10).map((user, index) => (
                  <div key={user.did} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-sm w-6">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{user.display_name || user.handle}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">@{user.handle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 dark:text-green-400">+{user.growth_percentage_24h}%</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{user.followers_count.toLocaleString()} total</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Most Followed */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">👑 Most Followed</h2>
              <div className="space-y-3">
                {data.most_followed.slice(0, 10).map((user, index) => (
                  <div key={user.did} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-sm w-6">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{user.display_name || user.handle}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">@{user.handle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600 dark:text-blue-400">{user.followers_count.toLocaleString()}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">followers</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top Posts */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-zinc-700"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">📝 Top Posts (24h)</h2>
              <div className="space-y-3">
                {data.top_posts.slice(0, 5).map((post, index) => (
                  <div key={post.uri} className="p-3 bg-slate-50 dark:bg-zinc-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-sm">#{index + 1}</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold">{post.engagement_score} pts</span>
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 text-sm mb-2 line-clamp-2">{post.text}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>@{post.author_handle}</span>
                      <div className="flex space-x-3">
                        <span>❤️ {post.like_count}</span>
                        <span>🔄 {post.repost_count}</span>
                        <span>💬 {post.reply_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
