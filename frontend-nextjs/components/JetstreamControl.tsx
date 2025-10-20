'use client';
import { useEffect, useState } from 'react';

type JetstreamStatus = {
  running: boolean;
  pid: number | null;
  processCount: number;
};

export function JetstreamControl() {
  const [status, setStatus] = useState<JetstreamStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/jetstream', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'status_check_failed');
      setStatus(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'status_check_failed');
    }
  }

  async function handleAction(action: 'start' | 'stop') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jetstream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'action_failed');
      setStatus(data.status);
    } catch (e: any) {
      setError(e?.message || 'action_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, []);

  const statusClass = status?.running 
    ? "flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
    : "flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400";
  
  const dotClass = status?.running 
    ? "w-2 h-2 rounded-full bg-green-500 animate-pulse"
    : "w-2 h-2 rounded-full bg-slate-400";

  const startBtnClass = (status?.running || loading)
    ? "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
    : "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-green-500 hover:bg-green-600 text-white";

  const stopBtnClass = (!status?.running || loading)
    ? "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
    : "flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-red-500 hover:bg-red-600 text-white";

  return (
    <div className="rounded-xl border bg-white/60 dark:bg-zinc-900/60 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Live Ingestion Control</h3>
        <div className="flex items-center gap-2">
          {status && (
            <div className={statusClass}>
              <div className={dotClass}></div>
              {status.running ? 'Running' : 'Stopped'}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
          {error}
        </div>
      )}

      {!status ? (
        <div className="text-sm opacity-70">Checking status…</div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Jetstream ingests posts, likes, reposts, and follows in real-time from the Bluesky network.
          </div>

          {status.running && status.pid && (
            <div className="text-xs text-slate-500">
              Process ID: {status.pid} · {status.processCount} process(es)
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleAction('start')}
              disabled={loading || status.running}
              className={startBtnClass}
            >
              {loading ? 'Starting…' : 'Start Ingestion'}
            </button>
            <button
              onClick={() => handleAction('stop')}
              disabled={loading || !status.running}
              className={stopBtnClass}
            >
              {loading ? 'Stopping…' : 'Stop Ingestion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
