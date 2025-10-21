'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/DashboardHeader';
import Link from 'next/link';

const API_BASE = 'http://100.69.129.86:3003';

export default function TrendingUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/trending?limit=100`);
      const result = await response.json();
      setUsers(result.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <DashboardHeader />

        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/bluefacts" className="text-blue-600 dark:text-blue-400 hover:underline">
              ← Back to BlueFacts
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            🚀 Trending Users (Last 24h)
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Users who gained the most followers on Bluesky in the last 24 hours
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-700 p-12 text-center">
            <div className="text-6xl mb-4">📈</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Trending Data Coming Soon
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Trending accounts will be available after we collect 24 hours of snapshots.
              Check back tomorrow to see who's gaining followers fastest!
            </p>
            <Link 
              href="/bluefacts/top-users"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Most Followed Users Instead →
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-700">
            <div className="p-6">
              <div className="grid gap-4">
                {users.map((user: any, index) => (
                  <motion.div
                    key={user.did}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-700 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                      {user.avatar && (
                        <img 
                          src={user.avatar} 
                          alt={user.display_name || user.handle}
                          className="w-12 h-12 rounded-full"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {user.display_name || user.handle}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">@{user.handle}</p>
                        {user.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                            {user.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        +{user.followers_gained_24h.toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">gained today</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {user.followers_count.toLocaleString()} total followers
                      </div>
                      {user.growth_percentage_24h > 0 && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          +{user.growth_percentage_24h}% growth
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
