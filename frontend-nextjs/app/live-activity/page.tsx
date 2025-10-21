import { LiveFeed } from '@/components/LiveFeed';
import { DashboardHeader } from '@/components/DashboardHeader';
import { BackgroundBeams } from '@/components/BackgroundBeams';

export const dynamic = 'force-dynamic';

export default function LiveActivityPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 dark:from-zinc-950 dark:via-purple-950/20 dark:to-zinc-900 overflow-hidden">
      <BackgroundBeams />
      <div className="container relative z-10 mx-auto px-4 py-8">
        <DashboardHeader />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Real-time Network Feed
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Live posts, likes, reposts, and follows from the Bluesky network
          </p>
        </div>

        <LiveFeed />
      </div>
    </main>
  );
}