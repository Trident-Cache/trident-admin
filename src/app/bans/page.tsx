'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatTimestamp } from '@/lib/format';

type BanType = 'url' | 'tag' | 'host';

// Shapes mirror @trident-cache/sdk BanInfo / BansResponse (declared in the SDK
// types but not re-exported from its package entry); inlined to keep this page
// self-contained and build-clean.
interface BanInfo {
  id: string;
  pattern: string;
  type: BanType;
  createdAt: string;
  expiresAt?: string;
}
interface BansResponse {
  bans: BanInfo[];
  total: number;
}

type Result = { ok: boolean; message: string } | null;

const TYPES: { name: BanType; desc: string }[] = [
  { name: 'url', desc: 'Ban a single URL or path prefix from the cache.' },
  { name: 'tag', desc: 'Ban every entry carrying a surrogate / cache tag.' },
  { name: 'host', desc: 'Ban all cached entries served for a hostname.' },
];

const TYPE_VARIANT: Record<string, 'info' | 'success' | 'warn'> = {
  url: 'info',
  tag: 'success',
  host: 'warn',
};

export default function BansPage() {
  const [data, setData] = useState<BansResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  // create form
  const [pattern, setPattern] = useState('');
  const [type, setType] = useState<BanType>('url');

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/bans'), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `status ${res.status}`);
      setData(json);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load bans');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const bans: BanInfo[] = data?.bans ?? [];
  const total = data?.total ?? bans.length;
  const now = Date.now();
  const active = bans.filter((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > now).length;

  const onCreate = async () => {
    const p = pattern.trim();
    if (!p) return;
    setBusy('create');
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/bans'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: p, type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `request failed (${res.status})`);
      setResult({ ok: true, message: `Ban created (${type}) — ${p}` });
      setPattern('');
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    } finally {
      setBusy(null);
      load();
    }
  };

  const onDelete = async (id: string) => {
    setBusy(`del:${id}`);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/bans/${encodeURIComponent(id)}`), { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error || `request failed (${res.status})`);
      setResult({ ok: true, message: `Ban ${id} removed.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <>
      <PageHead
        title="Bans"
        sub="Soft-purge rules that block matching entries from being served — by URL, tag, or host."
      />

      {loadErr && <div className="banner banner-danger" style={{ marginBottom: 16 }}>Cannot reach bans API: {loadErr}</div>}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <StatCard label="Total bans" value={data ? total : '—'} hint="all rules" />
        <StatCard label="Active" value={data ? active : '—'} hint="currently enforced" />
        <StatCard label="Expired" value={data ? total - active : '—'} hint="past TTL" />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Create form */}
        <Card title={<><Icon name="bans" size={14} /> Create ban</>} sub="Add a soft-purge rule. Matching entries stop being served immediately.">
          <label className="label-text">Type</label>
          <div className="seg" style={{ marginBottom: 12 }}>
            {TYPES.map((t) => (
              <button key={t.name} className={type === t.name ? 'active' : ''} onClick={() => setType(t.name)}>{t.name}</button>
            ))}
          </div>
          <p className="help-text" style={{ marginTop: -4, marginBottom: 12 }}>{TYPES.find((t) => t.name === type)?.desc}</p>

          <label className="label-text">Pattern</label>
          <input
            className="input mono"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={type === 'url' ? '/products/*' : type === 'tag' ? 'product-1234' : 'shop.example.com'}
            onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
          />
          <p className="help-text">The target {type} to ban. Expiry (if any) is governed by the server-side soft-purge grace period.</p>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onCreate} disabled={!pattern.trim() || busy != null}>
              <Icon name="plus" size={14} /> {busy === 'create' ? 'Creating…' : 'Create ban'}
            </button>
          </div>
        </Card>

        {/* How bans work */}
        <Card title={<><Icon name="info" size={14} /> How bans work</>}>
          <p style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.65 }}>
            A ban is a lazy <strong>soft purge</strong>: instead of evicting entries up front, Trident records the
            rule and rejects any cached response that matches on the next lookup. Bans match by{' '}
            <code className="mono">url</code>, <code className="mono">tag</code>, or <code className="mono">host</code>.
            A ban stays enforced until it is deleted or its server-side grace period (if configured) elapses.
          </p>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {TYPES.map((t) => (
              <div key={t.name} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Badge variant={TYPE_VARIANT[t.name]}>{t.name}</Badge>
                <span className="text-muted" style={{ fontSize: 12.5 }}>{t.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active bans table */}
      <Card
        title={<><Icon name="bans" size={14} /> Active bans</>}
        sub={`${total} rule${total === 1 ? '' : 's'}`}
        padded={false}
        className="col-span-3"
      >
        {bans.length === 0 ? (
          <div style={{ padding: 16 }}>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              No bans yet. Create a rule above to block matching entries from the cache.
            </p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pattern / target</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th>Expiry</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bans.map((ban) => {
                  const id = String(ban.id);
                  const expired = ban.expiresAt ? new Date(ban.expiresAt).getTime() <= now : false;
                  return (
                    <tr key={id}>
                      <td className="mono text-subtle" style={{ fontSize: 12 }}>{id}</td>
                      <td className="mono" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ban.pattern}</td>
                      <td><Badge variant={TYPE_VARIANT[ban.type] ?? 'info'}>{ban.type}</Badge></td>
                      <td className="text-subtle" style={{ fontSize: 12.5 }}>{ban.createdAt ? formatTimestamp(ban.createdAt) : '—'}</td>
                      <td className="text-subtle" style={{ fontSize: 12.5 }}>
                        {ban.expiresAt
                          ? <span className={expired ? 'text-danger' : ''}>{formatTimestamp(ban.expiresAt)}{expired ? ' (expired)' : ''}</span>
                          : <span className="text-subtle">never</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(id)}
                          disabled={busy != null}
                        >
                          <Icon name="trash" size={13} /> {busy === `del:${id}` ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
