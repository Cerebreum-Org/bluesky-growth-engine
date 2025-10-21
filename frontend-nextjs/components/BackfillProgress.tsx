'use client';

import { useState, useEffect } from 'react';

interface BackfillData {
  running: boolean;
  indexedUsers: number;
  newPosts?: number;
  newLikes?: number;
  newReposts: number;
  newFollows?: number;
  totalPosts?: number;
  totalLikes?: number;
  totalReposts: number;
  totalFollows?: number;
  recentEntries: { timestamp: string; message: string }[];
  lastUpdate: string;
  error?: string;
}

export function BackfillProgress() {
  const [data, setData] = useState<BackfillData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/backfill-progress');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch backfill progress:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
        <div className="animate-pulse">Loading backfill progress...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${data?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {data?.running ? 'Process Active' : 'Process Stopped'}
            </h2>
          </div>
        </div>
        {data?.running && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Last updated: {new Date(data.lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </div>

      {data?.running && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-200/50 dark:border-blue-700/50">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {data.indexedUsers.toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Users Processed</div>
            </div>
            <div className="bg-purple-500/10 dark:bg-purple-500/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-purple-200/50 dark:border-purple-700/50">
              <div className="text-3xl mb-2">📝</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                +{(data.newPosts ?? 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">New Posts</div>
              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Total: {(data.totalPosts ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-pink-500/10 dark:bg-pink-500/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-pink-200/50 dark:border-pink-700/50">
              <div className="text-3xl mb-2">❤️</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                +{(data.newLikes ?? 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">New Likes</div>
              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Total: {(data.totalLikes ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-cyan-500/10 dark:bg-cyan-500/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-cyan-200/50 dark:border-cyan-700/50">
              <div className="text-3xl mb-2">🔗</div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                +{(data.newFollows ?? 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">New Follows</div>
              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Total: {(data.totalFollows ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Activity</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
              {data.recentEntries.map((entry, idx) => (
                <div key={idx} className="text-slate-700 dark:text-slate-300 py-1 border-b border-slate-200/50 dark:border-zinc-700/50 last:border-0">
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!data?.running && (
        <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">⏸️</div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Not Running</h3>
            <p className="text-slate-600 dark:text-slate-400">The backfill process is not currently active</p>
          </div>
        </div>
      )}
    </div>
  );
}
