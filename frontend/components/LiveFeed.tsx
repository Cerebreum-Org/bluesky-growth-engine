'use client';

import { useEffect, useState } from 'react';

interface RecentUser {
  did: string;
  handle: string;
  display_name: string | null;
  followers_count: number;
  updated_at: string;
}

interface LiveStats {
  totalUsers: number;
  recentUsers: RecentUser[];
  timestamp: string;
}

export function LiveFeed() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [prevCount, setPrevCount] = useState<number>(0);
  const [growthRate, setGrowthRate] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/live-stats');
        const data = await res.json();
        
        if (data.totalUsers && prevCount > 0) {
          const newUsers = data.totalUsers - prevCount;
          setGrowthRate(newUsers);
        }
        
        setPrevCount(data.totalUsers);
        setStats(data);
      } catch (error) {
        console.error('Error fetching live stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, [prevCount]);

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white">🔴 Live Jetstream Feed</h2>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="animate-pulse text-red-500">●</span> Live Jetstream Feed
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            {stats.totalUsers.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Total Users</div>
          {growthRate > 0 && (
            <div className="text-xs text-green-400">+{growthRate} in last 3s</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Recently Updated Users:</h3>
        {stats.recentUsers.map((user, idx) => (
          <div
            key={user.did}
            className="bg-gray-700 rounded p-3 text-sm border border-gray-600 animate-fade-in"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-semibold text-white">
                  {user.display_name || user.handle}
                </div>
                <div className="text-xs text-gray-400">@{user.handle}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {user.followers_count.toLocaleString()} followers
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(user.updated_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Last update: {new Date(stats.timestamp).toLocaleTimeString()}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
