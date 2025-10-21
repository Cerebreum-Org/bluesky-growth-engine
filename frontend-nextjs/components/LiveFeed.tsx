'use client';

import { useEffect, useRef, useState } from 'react';

interface Activity {
  id: string;
  type: 'user' | 'post' | 'like' | 'repost';
  timestamp: string;
  data: {
    handle?: string;
    display_name?: string;
    followers_count?: number | null;
    text?: string;
  };
}

interface LiveActivity {
  counts: {
    users: number;
    posts: number;
    likes: number;
    reposts: number;
  };
  activities: Activity[];
  timestamp: string;
}

export function LiveFeed() {
  const [data, setData] = useState<LiveActivity | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pulseEffect, setPulseEffect] = useState<{[key: string]: boolean}>({});

  const lastCountsRef = useRef<LiveActivity['counts'] | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      console.log('[LiveFeed] 🔄 Fetching /api/live-activity...');
      try {
        const res = await fetch('/api/live-activity', { cache: 'no-store' });
        console.log('[LiveFeed] 📥 Fetch response status:', res.status, res.ok);
        
        const newData = await res.json();
        console.log('[LiveFeed] 📊 Received data:', {
          counts: newData.counts,
          activitiesLength: newData.activities?.length || 0,
          timestamp: newData.timestamp,
          sampleActivity: newData.activities?.[0]
        });
        
        // Trigger pulse effect if numbers changed (compare to last seen)
        const last = lastCountsRef.current;
        if (last) {
          const changed: {[key: string]: boolean} = {};
          if (newData.counts.users !== last.users) changed.users = true;
          if (newData.counts.posts !== last.posts) changed.posts = true;
          if (newData.counts.likes !== last.likes) changed.likes = true;
          if (newData.counts.reposts !== last.reposts) changed.reposts = true;
          
          if (Object.keys(changed).length > 0) {
            console.log('[LiveFeed] 💥 Counts changed:', changed);
            setPulseEffect(changed);
            setTimeout(() => setPulseEffect({}), 500);
          }
        }
        lastCountsRef.current = newData.counts;
        setData(newData);
        
        // Prepend new activities (dedupe by key)
        if (newData.activities && newData.activities.length > 0) {
          setActivities(prev => {
            console.log('[LiveFeed] 🔀 Merging activities. Previous count:', prev.length, 'New count:', newData.activities.length);
            const merged = [...newData.activities, ...prev];
            const seen = new Set<string>();
            const deduped: Activity[] = [];
            for (const a of merged) {
              const key = `${a.type}|${a.id}`;
              if (!seen.has(key)) {
                seen.add(key);
                deduped.push(a);
              }
              if (deduped.length >= 50) break;
            }
            console.log('[LiveFeed] ✅ After dedupe:', deduped.length, 'activities');
            return deduped;
          });
        } else {
          console.log('[LiveFeed] ⚠️ No activities in response');
        }
      } catch (error) {
        console.error('[LiveFeed] ❌ Error fetching live activity:', error);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 1500);
    return () => clearInterval(interval);
  }, []);

  const filteredActivities = activities.filter(a => 
    filter === 'all' || a.type === filter
  );

  console.log('[LiveFeed] 🎯 Rendering. Filter:', filter, 'Total activities:', activities.length, 'Filtered:', filteredActivities.length);

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'user': return '👤';
      case 'post': return '✍️';
      case 'like': return '❤️';
      case 'repost': return '🔄';
      default: return '📌';
    }
  };

  const getActivityColor = (type: string) => {
    switch(type) {
      case 'user': return 'bg-gray-800/10 border-gray-700/30 hover:bg-gray-800/20';
      case 'post': return 'bg-gray-800/10 border-gray-700/30 hover:bg-gray-800/20';
      case 'like': return 'bg-gray-800/10 border-gray-700/30 hover:bg-gray-800/20';
      case 'repost': return 'bg-gray-800/10 border-gray-700/30 hover:bg-gray-800/20';
      default: return 'bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20';
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  if (!data) {
    console.log('[LiveFeed] ⏳ Still loading (data is null)');
    return (
      <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          <span className="ml-3 text-slate-600 dark:text-slate-400">Loading live activity...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={'bg-gradient-to-br from-gray-900/20 to-black/10 dark:from-gray-900/30 dark:to-black/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700/30 dark:border-gray-600/30 transition-all duration-300 ' + (pulseEffect.users ? 'scale-105 ring-2 ring-gray-400' : '')}>
          <div className="text-3xl mb-2">👥</div>
          <div className={'text-3xl font-bold text-gray-100 tabular-nums transition-all duration-300 ' + (pulseEffect.users ? 'text-green-400' : '')}>
            {formatNumber(data.counts.users)}
          </div>
          <div className="text-sm text-gray-100/70 dark:text-gray-100/70 mt-1">New Users</div>
        </div>
        
        <div className={'bg-gradient-to-br from-gray-900/20 to-black/10 dark:from-gray-900/30 dark:to-black/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700/30 dark:border-gray-600/30 transition-all duration-300 ' + (pulseEffect.posts ? 'scale-105 ring-2 ring-gray-400' : '')}>
          <div className="text-3xl mb-2">✍️</div>
          <div className={'text-3xl font-bold text-gray-100 tabular-nums transition-all duration-300 ' + (pulseEffect.posts ? 'text-green-400' : '')}>
            {formatNumber(data.counts.posts)}
          </div>
          <div className="text-sm text-gray-100/70 dark:text-gray-100/70 mt-1">Posts</div>
        </div>
        
        <div className={'bg-gradient-to-br from-gray-900/20 to-black/10 dark:from-gray-900/30 dark:to-black/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700/30 dark:border-gray-600/30 transition-all duration-300 ' + (pulseEffect.likes ? 'scale-105 ring-2 ring-gray-400' : '')}>
          <div className="text-3xl mb-2">❤️</div>
          <div className={'text-3xl font-bold text-gray-100 tabular-nums transition-all duration-300 ' + (pulseEffect.likes ? 'text-green-400' : '')}>
            {formatNumber(data.counts.likes)}
          </div>
          <div className="text-sm text-gray-100/70 dark:text-gray-100/70 mt-1">Likes</div>
        </div>
        
        <div className={'bg-gradient-to-br from-gray-900/20 to-black/10 dark:from-gray-900/30 dark:to-black/20 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700/30 dark:border-gray-600/30 transition-all duration-300 ' + (pulseEffect.reposts ? 'scale-105 ring-2 ring-gray-400' : '')}>
          <div className="text-3xl mb-2">🔄</div>
          <div className={'text-3xl font-bold text-gray-100 tabular-nums transition-all duration-300 ' + (pulseEffect.reposts ? 'text-green-400' : '')}>
            {formatNumber(data.counts.reposts)}
          </div>
          <div className="text-sm text-gray-100/70 dark:text-gray-100/70 mt-1">Reposts</div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
        <div className="flex gap-2 flex-wrap">
          {['all', 'user', 'post', 'like', 'repost'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f 
                  ? 'px-4 py-2 rounded-lg font-medium transition-all bg-gray-700 text-white shadow-lg scale-105' 
                  : 'px-4 py-2 rounded-lg font-medium transition-all bg-slate-200/50 dark:bg-zinc-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-zinc-600/50'
              }
            >
              {f === 'all' ? '🌐 All' : getActivityIcon(f) + ' ' + f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Stream */}
      <div className="bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200/50 dark:border-zinc-700/50">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="animate-pulse">🔴</span> Live Activity Stream
        </h3>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {activities.length === 0 ? 'No activities yet...' : `No ${filter} activities to show (${activities.length} total activities)`}
            </div>
          ) : (
            filteredActivities.map((activity, idx) => (
              <div
                key={`${activity.type}-${activity.id}`}
                className={getActivityColor(activity.type) + ' border rounded-lg p-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer animate-fadeIn'}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {activity.data.display_name || activity.data.handle || 'Unknown'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {activity.data.handle && (
                        <span className="text-gray-100 dark:text-gray-100">@{activity.data.handle}</span>
                      )}
                      {activity.type === 'user' && activity.data.followers_count !== null && (
                        <span className="ml-2 text-xs bg-slate-200 dark:bg-zinc-700 px-2 py-1 rounded">
                          {formatNumber(activity.data.followers_count || 0)} followers
                        </span>
                      )}
                    </div>
                    {activity.data.text && (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                        {activity.data.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
