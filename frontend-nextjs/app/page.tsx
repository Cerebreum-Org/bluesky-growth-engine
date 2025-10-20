import { IngestionHealth } from '@/components/IngestionHealth';
import { JetstreamControl } from '@/components/JetstreamControl';
import { StatsCards } from '@/components/StatsCards';
import { UserList } from '@/components/UserList';
import { NetworkStats } from '@/components/NetworkStats';
import { NetworkDensity } from '@/components/NetworkDensity';
import { GrowthTargets } from '@/components/GrowthTargets';
import { PowerUsers } from '@/components/PowerUsers';
import { ProgressTracker } from '@/components/ProgressTracker';
import { EngagementAnalytics } from '@/components/EngagementAnalytics';
import { DashboardHeader } from '@/components/DashboardHeader';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <DashboardHeader />

        <div className="space-y-6">
          {/* Core Stats & Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <StatsCards />
            </div>
            <div>
              <ProgressTracker />
            </div>
          </div>

          {/* Network Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <IngestionHealth />
            </div>
            <div>
              <JetstreamControl />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetworkStats />
            <NetworkDensity />
          </div>

          {/* Growth Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GrowthTargets />
            <PowerUsers />
          </div>

          {/* Engagement & Content */}
          <EngagementAnalytics />

          {/* Detailed User Explorer */}
          <UserList />
        </div>
      </div>
    </main>
  );
}
