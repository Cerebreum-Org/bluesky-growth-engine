import { BackfillProgress } from '@/components/BackfillProgress';
import { DashboardHeader } from '@/components/DashboardHeader';
import { BackgroundBeams } from '@/components/BackgroundBeams';

export const dynamic = 'force-dynamic';

export default function BackfillProgressPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-slate-100 dark:from-zinc-950 dark:via-green-950/20 dark:to-zinc-900 overflow-hidden">
      <BackgroundBeams />
      <div className="container relative z-10 mx-auto px-4 py-8">
        <DashboardHeader />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Backfill Progress
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Historical data collection via the Bluesky API
          </p>
        </div>

        <BackfillProgress />
      </div>
    </main>
  );
}