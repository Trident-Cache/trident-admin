'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

type NavItem = { href: string; label: string; icon: IconName; badge?: string };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Observe',
    items: [
      { href: '/', label: 'Overview', icon: 'dashboard' },
      { href: '/events', label: 'Events', icon: 'events', badge: 'LIVE' },
      { href: '/stats', label: 'Statistics', icon: 'stats' },
    ],
  },
  {
    group: 'Cache',
    items: [
      { href: '/cache', label: 'Browser', icon: 'cache' },
      { href: '/cache/coverage', label: 'Coverage', icon: 'cache' },
      { href: '/explain', label: 'Explain', icon: 'search' },
      { href: '/purge', label: 'Purge', icon: 'purge' },
      { href: '/bans', label: 'Bans', icon: 'bans' },
    ],
  },
  {
    group: 'Warm & Launch',
    items: [
      { href: '/warmer', label: 'Cache Warmer', icon: 'warmer' },
      { href: '/launch', label: 'Launch Mode', icon: 'launch' },
      { href: '/reflect', label: 'Reflect Mode', icon: 'reflect' },
    ],
  },
  {
    group: 'Infrastructure',
    items: [
      { href: '/backends', label: 'Backends', icon: 'backends' },
      { href: '/dns', label: 'DNS', icon: 'dns' },
      { href: '/denoisers', label: 'Denoisers', icon: 'denoise' },
    ],
  },
  {
    group: 'System',
    items: [{ href: '/config', label: 'Config', icon: 'config' }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** The connected engine's version (GET /api/status), not a label baked into the build. */
function useEngineVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(apiUrl('/api/status'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (live && typeof status?.version === 'string') {
          setVersion(status.version);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return version;
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  const env = process.env.NEXT_PUBLIC_TRIDENT_ENV ?? 'production';
  const engineVersion = useEngineVersion();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M5 8l7-6 7 6M8 12h8M9 17h6" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">Trident</span>
          <span className="brand-version">{engineVersion !== null ? `engine v${engineVersion}` : 'engine —'}</span>
        </div>
      </div>

      <div className="env-switcher">
        <span className="env-dot" />
        <div className="env-info">
          <div className="env-label">Environment</div>
          <div className="env-name">{env}</div>
        </div>
        <span className="env-chev"><Icon name="chevDown" size={14} /></span>
      </div>

      <nav className="nav-section">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive(pathname, item.href) ? 'active' : ''}`}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span style={{ width: 8, height: 8, borderRadius: 50, background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-soft)', flexShrink: 0 }} />
        <span className="uptime">Trident Admin</span>
      </div>
    </aside>
  );
}
