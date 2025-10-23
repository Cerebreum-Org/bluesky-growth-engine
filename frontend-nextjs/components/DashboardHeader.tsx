'use client';

import { DarkModeToggle } from './DarkModeToggle';
import { Navigation } from './Navigation';

export function DashboardHeader() {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Bluesky Growth Engine
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Advanced social graph analytics for neoreactionary.bsky.social
          </p>
        </div>
        <DarkModeToggle />
      </div>
      <Navigation />
    </div>
  );
}
