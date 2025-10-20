'use client';
import { useEffect, useState } from 'react';

type Metrics = {
  coverage: { totalUsers: number; usersWithPosts: number; percent: number };
  rate: { postsPerMin: number; followsPerMin: number; likesPerMin: number; repostsPerMin: number };
  totals: { posts: number; follows: number; likes: number; reposts: number };
  latest: { post: string | null; follow: string | null; like: string | null; repost: string | null };
};

export function IngestionHealth() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchMetrics() {
    try {
      const res = await fetch('/api/metrics', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'metrics_error');
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'metrics_error');
    }
  }

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border bg-white/60 dark:bg-zinc-900/60 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Ingestion health</h3>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
      {!data ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Posts/min" value={data.rate.postsPerMin.toFixed(0)} />
          <Stat label="Likes/min" value={data.rate.likesPerMin.toFixed(0)} />
          <Stat label="Reposts/min" value={data.rate.repostsPerMin.toFixed(0)} />
          <Stat label="Follows/min" value={data.rate.followsPerMin.toFixed(0)} />
          <Stat label="Coverage" value={`${data.coverage.percent.toFixed(2)}%`} sub={`${data.coverage.usersWithPosts.toLocaleString()} / ${data.coverage.totalUsers.toLocaleString()}`} />
          <Stat label="Total posts" value={data.totals.posts.toLocaleString()} />
          <Stat label="Total likes" value={data.totals.likes.toLocaleString()} />
          <Stat label="Total follows" value={data.totals.follows.toLocaleString()} />
        </div>
      )}
      {data && (
        <div className="mt-4 text-xs opacity-70">
          <div>Latest: posts {data.latest.post || '—'} · likes {data.latest.like || '—'} · reposts {data.latest.repost || '—'} · follows {data.latest.follow || '—'}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}
