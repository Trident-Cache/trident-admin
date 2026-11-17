'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';
import { safeNextPath } from '@/lib/panel/next-path';

/** The screen to open after signing in: the one the visitor was sent here from, or the overview. */
function destination(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return apiUrl(safeNextPath(next));
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A visitor who already has a session, or a panel with no login at all, has
  // nothing to do here. This also covers arriving through a link on another
  // site: the browser withholds the session cookie from that first request,
  // so the panel answers with this page although the session is still good.
  useEffect(() => {
    let live = true;
    fetch(apiUrl('/api/auth/session'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (live && body && (body.loginRequired === false || body.authenticated === true)) {
          window.location.replace(destination());
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
      });
      if (res.ok || res.status === 404) {
        // 404: this panel has no login, so there is nothing to sign in to.
        window.location.assign(destination());
        return;
      }
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === 'string' ? body.error : `Sign-in failed (HTTP ${res.status}).`);
    } catch {
      setError('The panel did not answer. Check the connection and try again.');
    }
    setBusy(false);
  };

  return (
    <form className="card" onSubmit={submit} style={{ width: '100%', maxWidth: 380, padding: 28 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Trident Admin</h1>
      <p className="help-text" style={{ marginBottom: 18 }}>Sign in to manage the cache.</p>

      <label className="label-text" htmlFor="panel-password">Password</label>
      <input
        id="panel-password"
        className="input"
        type="password"
        name="password"
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <div className="banner banner-danger" role="alert" style={{ marginTop: 14 }}>
          <Icon name="info" size={16} /> {error}
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={busy || password === ''} style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
