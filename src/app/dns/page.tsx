'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatTimestamp } from '@/lib/format';

import type { DiscoveryListResponse } from '@trident-cache/sdk';
import { dnsRefreshMessage } from '@/lib/dns';

type Result = { ok: boolean; message: string } | null;

export default function DnsPage() {
  const [data, setData] = useState<DiscoveryListResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/dns/list'), { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `status ${res.status}`);
      setData(body);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load DNS discovery');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const refresh = async (name: string) => {
    setBusy(name);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/dns/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `request failed (${res.status})`);
      setResult({
        ok: true,
        message: dnsRefreshMessage(name, body),
      });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : `failed to refresh ${name}` });
    } finally {
      setBusy(null);
      load();
    }
  };

  const refreshAll = async () => {
    const names = data?.backends.map((b) => b.backendName) ?? [];
    if (names.length === 0) return;
    setBusy('__all__');
    setResult(null);
    let refreshed = 0;
    let failed = 0;
    for (const name of names) {
      try {
        const res = await fetch(apiUrl('/api/dns/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error);
        dnsRefreshMessage(name, body);
        refreshed += 1;
      } catch {
        failed += 1;
      }
    }
    setBusy(null);
    setResult(
      failed > 0
        ? { ok: false, message: `Re-resolved ${refreshed}/${names.length} target(s), ${failed} failed.` }
        : { ok: true, message: `Re-resolved ${refreshed} target(s).` },
    );
    load();
  };

  const backends = data?.backends ?? [];
  const total = backends.length;
  const addresses = backends.reduce((acc, b) => acc + b.addresses.length, 0);

  return (
    <>
      <PageHead
        title="DNS Discovery"
        sub="DNS-based service discovery: resolved backend targets, their addresses, and refresh status."
        actions={
          <button className="btn btn-primary" onClick={refreshAll} disabled={total === 0 || busy != null}>
            <Icon name="refresh" size={14} /> {busy === '__all__' ? 'Refreshing…' : 'Refresh all'}
          </button>
        }
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot reach DNS discovery API: {loadErr}
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard label="Targets" value={data ? total : '—'} hint="discovered backends" />
        <StatCard
          label="Healthy"
          value="—"
          hint="not reported by DNS list"
        />
        <StatCard
          label="Unhealthy"
          value="—"
          hint="not reported by DNS list"
        />
        <StatCard label="Resolved addresses" value={data ? addresses : '—'} hint="across all targets" />
      </div>

      {data && total === 0 ? (
        <Card title={<><Icon name="dns" size={14} /> Discovery targets</>}>
          <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
            DNS discovery is not configured. Define a discovery-backed backend in{' '}
            <code className="mono">trident.toml</code> to populate this list.
          </p>
        </Card>
      ) : (
        <Card
          title={<><Icon name="dns" size={14} /> Discovery targets</>}
          sub={total > 0 ? `${total} target${total === 1 ? '' : 's'} · ${addresses} resolved address${addresses === 1 ? '' : 'es'}` : undefined}
          padded={false}
        >
          <div className="table-wrapper" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>DNS name</th>
                  <th>Resolved addresses</th>
                  <th>Last refresh</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {backends.map((b) => (
                  <tr key={b.backendName}>
                    <td style={{ fontWeight: 600 }}>{b.backendName}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{b.hostname}</td>
                    <td>
                      {b.addresses.length > 0 ? (
                        <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
                          {b.addresses.map((addr) => (
                            <span key={addr} className="badge mono">{addr}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="text-subtle" style={{ fontSize: 12 }}>{b.stats.lastSuccess > 0 ? formatTimestamp(new Date(b.stats.lastSuccess).toISOString()) : '—'}</td>
                    <td>
                      <Badge variant="default">not reported</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => refresh(b.backendName)}
                        disabled={busy != null}
                      >
                        <Icon name="refresh" size={12} /> {busy === b.backendName ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
