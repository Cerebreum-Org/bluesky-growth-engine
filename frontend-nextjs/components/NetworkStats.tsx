'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FollowerDistribution {
  range: string;
  count: number;
}

export function NetworkStats() {
  const [distribution, setDistribution] = useState<FollowerDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDistribution() {
      try {
        // Use parallel queries to count users in each bucket
        const buckets: Record<string, number> = {
          '0-100': 0,
          '101-500': 0,
          '501-1K': 0,
          '1K-5K': 0,
          '5K-10K': 0,
          '10K+': 0,
        };

        // Count users in each range
        const [b1, b2, b3, b4, b5, b6] = await Promise.all([
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).lte('followers_count', 100),
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).gt('followers_count', 100).lte('followers_count', 500),
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).gt('followers_count', 500).lte('followers_count', 1000),
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).gt('followers_count', 1000).lte('followers_count', 5000),
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).gt('followers_count', 5000).lte('followers_count', 10000),
          supabase.from('bluesky_users').select('*', { count: 'exact', head: true }).gt('followers_count', 10000),
        ]);

        buckets['0-100'] = b1.count || 0;
        buckets['101-500'] = b2.count || 0;
        buckets['501-1K'] = b3.count || 0;
        buckets['1K-5K'] = b4.count || 0;
        buckets['5K-10K'] = b5.count || 0;
        buckets['10K+'] = b6.count || 0;

        const dist = Object.entries(buckets).map(([range, count]) => ({
          range,
          count,
        }));

        setDistribution(dist);
      } catch (error) {
        console.error('Error fetching distribution:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDistribution();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-4">Network Distribution</h2>
        <div className="h-64 bg-slate-100 dark:bg-zinc-800/50 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-4">Follower Distribution</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-600" />
            <XAxis dataKey="range" stroke="#64748b" className="dark:stroke-slate-400" />
            <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
        Distribution of users by follower count across the network
      </p>
    </div>
  );
}
