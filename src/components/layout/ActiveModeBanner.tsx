'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

type ActiveMode = { key: string; label: string; detail: string; href: string; icon: IconName };

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(apiUrl(path), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Shell-level warning strip. Whenever a special operating mode is live
 * (Reflect / Launch / Cache Warmer), it shows a prominent orange gradient bar
 * with white text across the top of every screen so the operator can never
 * forget the cache is in a non-normal state. Renders nothing when all modes
 * are idle.
 */
export function ActiveModeBanner() {
  const [modes, setModes] = useState<ActiveMode[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const [reflect, launch, warmer, status] = await Promise.all([
        getJson('/api/reflect/status'),
        getJson('/api/launch/status'),
        getJson('/api/warmer/status'),
        getJson('/api/status'),
      ]);
      const out: ActiveMode[] = [];

      // Degraded first — it's the most critical (license check failed →
      // pass-through, nothing is being cached).
      if (status?.mode === 'degraded') {
        out.push({
          key: 'degraded',
          label: 'Degraded',
          detail: `license ${status.license ?? 'invalid'} · pass-through, no caching`,
          href: '/',
          icon: 'info',
        });
      }

      if (reflect?.enabled) {
        const q = reflect.queuedPurges ?? 0;
        out.push({
          key: 'reflect',
          label: 'Reflect Mode',
          detail: `${reflect.mode ?? 'active'} · ${q} purge${q === 1 ? '' : 's'} queued${reflect.reason ? ` · ${reflect.reason}` : ''}`,
          href: '/reflect',
          icon: 'reflect',
        });
      }
      if (launch?.active) {
        const pct = launch.progress ? ` · ${Math.round(launch.progress.percent)}% warmed` : '';
        out.push({ key: 'launch', label: 'Launch Mode', detail: `${launch.state}${pct}`, href: '/launch', icon: 'launch' });
      }
      if (warmer?.state === 'running') {
        const p = warmer.currentRun;
        out.push({
          key: 'warmer',
          label: 'Cache Warmer',
          detail: p ? `${p.completed}/${p.total} (${Math.round(p.percent)}%)` : 'running',
          href: '/warmer',
          icon: 'warmer',
        });
      }

      if (alive) setModes(out);
    };

    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (modes.length === 0) return null;

  return (
    <div className="mode-banner" role="status" aria-live="polite">
      <span className="pulse-dot" aria-hidden />
      {modes.map((m, i) => (
        <Fragment key={m.key}>
          {i > 0 && <span className="mode-sep" aria-hidden />}
          <span className="mode-pill">
            <Icon name={m.icon} size={15} />
            <span className="mode-label">{m.label}</span>
            <span className="mode-detail">{m.detail}</span>
          </span>
        </Fragment>
      ))}
      <Link className="mode-link" href={modes[0].href}>
        Manage <Icon name="chev" size={13} />
      </Link>
    </div>
  );
}
