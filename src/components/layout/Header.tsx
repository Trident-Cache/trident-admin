'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/cache': 'Cache Browser',
  '/cache/tags': 'Cache Tags',
  '/purge': 'Purge',
  '/backends': 'Backends',
  '/dns': 'DNS Discovery',
  '/bans': 'Bans',
  '/warmer': 'Cache Warmer',
  '/launch': 'Launch Mode',
  '/reflect': 'Reflect Mode',
  '/denoisers': 'Denoisers',
  '/events': 'Events',
  '/config': 'Configuration',
  '/stats': 'Statistics',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + (pathname.split('/')[1] ?? '');
  return TITLES[base] ?? 'Trident Admin';
}

export function Header({ canSignOut = false }: { canSignOut?: boolean }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);
  const title = titleFor(pathname);

  const refresh = () => {
    setSpin(true);
    startTransition(() => router.refresh());
    setTimeout(() => setSpin(false), 600);
  };

  // A full page load afterwards, so nothing fetched under the old session stays on screen.
  const signOut = async () => {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', cache: 'no-store' }).catch(() => undefined);
    window.location.assign(apiUrl('/login'));
  };

  return (
    <header className="topbar">
      <div className="crumbs">
        <span>Trident</span>
        <span className="sep"><Icon name="chev" size={12} /></span>
        <span className="here">{title}</span>
      </div>

      <div className="topbar-search" role="search">
        <Icon name="search" size={14} />
        <input placeholder="Search URL, tag, ban, backend…" aria-label="Search" />
        <kbd>⌘K</kbd>
      </div>

      <div className="topbar-actions">
        <span className="health-chip" title="Admin API reachable">
          <span className="dot" />
          <span>Healthy</span>
        </span>
        <button className="icon-btn" title="Refresh data" onClick={refresh} disabled={pending} aria-label="Refresh">
          <span style={{ display: 'inline-flex', animation: spin ? 'spin 0.6s linear' : undefined }}>
            <Icon name="refresh" size={14} />
          </span>
        </button>
        {canSignOut && (
          <button className="btn btn-sm" onClick={signOut} title="End this session">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
