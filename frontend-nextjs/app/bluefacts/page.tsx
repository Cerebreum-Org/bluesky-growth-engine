'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/DashboardHeader';
import Link from 'next/link';

interface TrendingUser {
  did: string;
  handle: string;
  displayName: string;
  followers: number;
  growth_24h: number;
  avatar: string;
}

interface DashboardData {
  trending: TrendingUser[];
  fastest_growing: TrendingUser[];
  most_followed: TrendingUser[];
  top_posts: unknown[];
  feed_stats: {
    total_posts_24h: number;
    avg_engagement_per_post: number;
  };
  network_stats: {
    total_users: number;
    new_users_24h: number;
  };
}

const API_BASE = 'http://100.69.129.86:3003';

export default function BlueFacts() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`);
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.open(`https://bsky.app/profile/${searchQuery.trim()}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="container mx-auto px-4 py-8">
        <DashboardHeader />

        {/* Hero Section */}
        <div className="text-center mb-16 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="flex items-center justify-center text-6xl font-bold text-slate-900 dark:text-white mb-6">
              <span className="mr-4 text-7xl">🦋</span>
              BlueFacts
            </h1>
            <h2 className="text-3xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Bluesky Trends and Insights
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Discover interesting people and trends on Bluesky
            </p>
          </motion.div>

          {/* Profile Search Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-50 dark:bg-zinc-900 rounded-2xl p-8 max-w-2xl mx-auto shadow-lg"
          >
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Look Up Any Bluesky Profile & Stats
            </h3>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a Bluesky profile..." 
                className="flex-1 px-6 py-4 text-lg border border-slate-300 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button 
                type="submit"
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg"
              >
                Search
              </button>
            </form>
          </motion.div>
        </div>

        {/* Main Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Explore Bluesky User Rankings
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Daily updated rankings of the most popular users on Bluesky.
          </p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {/* Most Popular */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="group"
          >
            <Link href="/bluefacts/top-users">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-blue-100 dark:border-blue-800">
                <div className="text-5xl mb-6">🌟</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Most popular users on Bluesky
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Discover the top 1000 users with the most followers on Bluesky.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold">
                  Most popular →
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Trending 24h */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="group"
          >
            <Link href="/bluefacts/trending">
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-green-100 dark:border-green-800">
                <div className="text-5xl mb-6">🚀</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Trending users last 24h
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Check out who gained the most followers on Bluesky in the last 24 hours.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold">
                  Trending 24h →
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Fastest Growing */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="group"
          >
            <Link href="/bluefacts/fastest-growing">
              <div className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950/50 dark:to-rose-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-red-100 dark:border-red-800">
                <div className="text-5xl mb-6">🔥</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Fastest growing accounts
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  These users had the strongest relative follower growth on Bluesky in the last 24 hours.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold">
                  Fastest Growing →
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Top Posts */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="group"
          >
            <Link href="/bluefacts/top-posts">
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/50 dark:to-violet-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-purple-100 dark:border-purple-800">
                <div className="text-5xl mb-6">📝</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Top Posts
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Most engaging posts today with the highest interaction rates.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold">
                  Top Posts →
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Top Videos */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="group"
          >
            <Link href="/bluefacts/top-videos">
              <div className="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/50 dark:to-amber-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-orange-100 dark:border-orange-800">
                <div className="text-5xl mb-6">🎥</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Top Videos
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Most popular video content shared on Bluesky.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-semibold">
                  Top Videos →
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Bluesky Growth */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="group"
          >
            <Link href="/bluefacts/network-growth">
              <div className="bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950/50 dark:to-cyan-900/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group-hover:scale-105 border border-teal-100 dark:border-teal-800">
                <div className="text-5xl mb-6">📈</div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Bluesky User Growth
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Historical data showing how Bluesky&apos;s user base has grown over time.
                </p>
                <div className="inline-flex items-center px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-semibold">
                  Growth Stats →
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Live Stats */}
        {!loading && data && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="bg-slate-50 dark:bg-zinc-900 rounded-2xl p-8 mb-16"
          >
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
              Live Bluesky Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {data.network_stats.total_users?.toLocaleString() || '0'}
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">Total Users</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                  +{data.network_stats.new_users_24h?.toLocaleString() || '0'}
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">New Today</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  {data.feed_stats.total_posts_24h?.toLocaleString() || '0'}
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">Posts Today</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {data.feed_stats.avg_engagement_per_post?.toFixed(1) || '0'}
                </div>
                <div className="text-slate-600 dark:text-slate-400 font-medium">Avg Engagement</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="text-center py-12"
        >
          <div className="mb-6">
            <a 
              href="https://bsky.app/profile/bluefacts.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg"
            >
              Follow us on Bluesky
            </a>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Built with real Bluesky data - Updated daily
          </p>
        </motion.div>
      </div>
    </div>
  );
}
