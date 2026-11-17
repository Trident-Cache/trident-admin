'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ActiveModeBanner } from '@/components/layout/ActiveModeBanner';
import { Icon } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

interface PanelSession {
  loginRequired: boolean;
  authenticated: boolean;
}

/**
 * Whether this panel asks for a login. Asked of the server at run time: the
 * answer depends on the deployment's environment, which is not known when the
 * pages are built.
 */
function usePanelSession(): PanelSession | null {
  const [session, setSession] = useState<PanelSession | null>(null);
  useEffect(() => {
    let live = true;
    fetch(apiUrl('/api/auth/session'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (live && body && typeof body.loginRequired === 'boolean') {
          setSession({ loginRequired: body.loginRequired, authenticated: body.authenticated === true });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return session;
}

/** Shown on every screen while the panel runs without a login. */
function OpenAccessBanner() {
  return (
    <div className="banner banner-danger" role="alert" style={{ borderRadius: 0, flexWrap: 'wrap' }}>
      <Icon name="info" size={16} />
      <strong>No login is configured.</strong>
      <span>
        Anyone who can reach this address can purge the cache, drain backends and start a launch. Set{' '}
        <span className="mono">TRIDENT_PANEL_PASSWORD</span> to require a sign-in.
      </span>
    </div>
  );
}

/**
 * The frame around every screen: sidebar, banners, top bar. The sign-in page
 * is drawn without it, because everything in the frame calls the API and a
 * visitor who has not signed in yet may not.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const session = usePanelSession();

  if (pathname === '/login') {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>{children}</main>;
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        {session?.loginRequired === false && <OpenAccessBanner />}
        <ActiveModeBanner />
        <Header canSignOut={session?.loginRequired === true} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
