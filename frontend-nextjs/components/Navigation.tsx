'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/live-activity', label: 'Live Network Activity' },
  { href: '/backfill-progress', label: 'Backfill Progress' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex space-x-6 border-b border-slate-700 mb-6">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`pb-3 px-2 border-b-2 transition-colors ${
              isActive
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
