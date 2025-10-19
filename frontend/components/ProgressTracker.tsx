'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProgressStats {
  totalUsers: number;
  usersWithPosts: number;
  totalPosts: number;
  totalFollows: number;
  completion: number;
  hoursRemaining: number;
  daysRemaining: number;
  isActive: boolean;
}

export function ProgressTracker() {
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        // Get total users
        const { count: userCount } = await supabase
          .from('bluesky_users')
          .select('*', { count: 'exact', head: true });

        // Get users with posts (assuming post tracking exists)
        const { count: postsUserCount } = await supabase
          .from('bluesky_users')
          .select('*', { count: 'exact', head: true })
          .gt('posts_count', 0);

        // Get total follows
        const { count: followCount } = await supabase
          .from('bluesky_follows')
          .select('*', { count: 'exact', head: true });

        // Calculate progress metrics
        const total = userCount || 0;
        const withPosts = postsUserCount || 0;
        const completion = total > 0 ? (withPosts / total) * 100 : 0;
        
        // Estimate remaining time (simple heuristic)
        const remaining = total - withPosts;
        const rate = 300; // users per hour (adjust based on actual rate)
        const hoursRemaining = remaining / rate;

        setProgress({
          totalUsers: total,
          usersWithPosts: withPosts,
          totalPosts: 0, // Would need actual post count
          totalFollows: followCount || 0,
          completion,
          hoursRemaining,
          daysRemaining: hoursRemaining / 24,
          isActive: completion < 100 && remaining > 0
        });
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProgress, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded"></div>
          <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!progress) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Network Indexing Progress</h2>
        <div className={`w-2 h-2 rounded-full ${progress.isActive ? 'bg-green-500 dark:bg-green-400 animate-pulse' : 'bg-slate-400 dark:bg-gray-600'}`}></div>
      </div>

      <div className="space-y-4">
        {/* Progress Description */}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Tracking progress of indexing the entire Bluesky network. {progress.usersWithPosts.toLocaleString()} of {progress.totalUsers.toLocaleString()} users scraped.
        </p>
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Total Network Coverage</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{progress.completion.toFixed(2)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.completion, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-600 dark:text-slate-400">Total Users</div>
            <div className="font-bold text-slate-900 dark:text-slate-100">{progress.totalUsers.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-600 dark:text-slate-400">Users Indexed</div>
            <div className="font-bold text-slate-900 dark:text-slate-100">{progress.usersWithPosts.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-600 dark:text-slate-400">Relationships</div>
            <div className="font-bold text-slate-900 dark:text-slate-100">{progress.totalFollows.toLocaleString()}</div>
          </div>
        </div>

        {/* Time Estimates */}
        {progress.isActive && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div>Est. Time Remaining:</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {progress.daysRemaining > 1 
                  ? `${progress.daysRemaining.toFixed(1)} days`
                  : `${progress.hoursRemaining.toFixed(1)} hours`
                }
              </div>
            </div>
          </div>
        )}

        {!progress.isActive && progress.completion >= 100 && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center text-green-600 dark:text-green-400 text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Network Fully Indexed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}