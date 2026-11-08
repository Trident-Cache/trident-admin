'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReflectStatusResponse, ReflectLevel } from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

type Result = { ok: boolean; message: string } | null;

const MODES: { name: ReflectLevel; desc: string }[] = [
  { name: 'full', desc: 'Serve everything from cache; every backend-bound request is shielded.' },
  { name: 'selective', desc: 'Shield only entries matching the emergency tag; the rest behave normally.' },
  { name: 'ttl_extension', desc: 'Multiply remaining TTLs so existing entries stay fresh far longer.' },
];

export default function ReflectPage() {
  const [status, setStatus] = useState<ReflectStatusResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  // enable form
  const [level, setLevel] = useState<ReflectLevel>('full');
  const [duration, setDuration] = useState('30m');
  const [reason, setReason] = useState('');

  const active = status?.enabled === true;

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/reflect/status'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `status ${res.status}`);
      setStatus(data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load reflect status');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, active ? 1500 : 5000);
    return () => clearInterval(t);
  }, [load, active]);

  const post = async (path: string, label: string, body?: unknown) => {
    setBusy(label);
    setResult(null);
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
      return data;
    } finally {
      setBusy(null);
      load();
    }
  };

  const onEnable = async () => {
    try {
      await post('/api/reflect/enable', 'enable', { level, duration: duration || undefined, reason: reason || undefined });
      setResult({ ok: true, message: `Reflect enabled (${level}) — purges are now queued, cache is shielded.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onDisable = async (mode: 'replay' | 'hard') => {
    try {
      const d = await post('/api/reflect/disable', 'disable', { mode });
      setResult({ ok: true, message: `Reflect disabled (${mode}) — ${d.queuedPurges ?? 0} queued purge(s) ${mode === 'replay' ? 'replayed' : 'dropped'}.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  return (
    <>
      <PageHead
        title="Reflect Mode"
        sub="Emergency origin shield: serve cached/stale content and queue purges during a spike or outage."
        actions={
          active ? (
            <>
              <button className="btn btn-primary" onClick={() => onDisable('replay')} disabled={busy != null}>
                <Icon name="refresh" size={14} /> {busy === 'disable' ? 'Disabling…' : 'Disable (replay purges)'}
              </button>
              <button className="btn btn-danger" onClick={() => onDisable('hard')} disabled={busy != null}>
                <Icon name="trash" size={14} /> Disable (drop purges)
              </button>
            </>
          ) : undefined
        }
      />

      {loadErr && <div className="banner banner-danger" style={{ marginBottom: 16 }}>Cannot reach reflect API: {loadErr}</div>}

      {active && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <Icon name="reflect" size={16} />
          <span><strong>Reflect is ACTIVE</strong> ({status?.mode}). Purges are being queued and the cache is shielding the origin{status?.reason ? ` — "${status.reason}"` : ''}.</span>
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard label="Status" value={<Badge variant={active ? 'warn' : 'default'} dot>{active ? 'active' : 'inactive'}</Badge>} hint={status?.mode ?? '—'} />
        <StatCard label="Queued purges" value={status ? status.queuedPurges : '—'} hint="deferred while active" />
        <StatCard label="Blocked requests" value={status ? status.blockedPurgeRequests : '—'} hint="since enable" />
        <StatCard label="Active for" value={<span className="mono" style={{ fontSize: 14 }}>{status?.duration ?? '—'}</span>} />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {!active ? (
          <Card title={<><Icon name="reflect" size={14} /> Enable reflect</>} sub="Shield the origin and start queueing purges.">
            <label className="label-text">Mode</label>
            <div className="seg" style={{ marginBottom: 12 }}>
              {MODES.map((m) => (
                <button key={m.name} className={level === m.name ? 'active' : ''} onClick={() => setLevel(m.name)}>{m.name}</button>
              ))}
            </div>
            <div className="help-text" style={{ marginTop: -4, marginBottom: 12 }}>{MODES.find((m) => m.name === level)?.desc}</div>
            <div className="grid-2">
              <div>
                <label className="label-text">Auto-disable after</label>
                <input className="input mono" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30m" />
              </div>
              <div>
                <label className="label-text">Reason</label>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="flash sale / origin incident" />
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={onEnable} disabled={busy != null}>
                <Icon name="reflect" size={14} /> {busy === 'enable' ? 'Enabling…' : 'Enable reflect'}
              </button>
            </div>
          </Card>
        ) : (
          <Card title={<><Icon name="queue" size={14} /> Queued purges</>} sub="Deferred while reflect is active — replayed on disable.">
            <div className="stat-value tnum" style={{ fontSize: 40 }}>{status?.queuedPurges ?? 0}</div>
            <div className="help-text">These purges are held back. <strong>Disable (replay)</strong> runs them; <strong>Disable (drop)</strong> discards them.</div>
          </Card>
        )}

        <Card title={<><Icon name="info" size={14} /> How reflect works</>}>
          <p style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.65 }}>
            A circuit-breaker for incidents: while active, Trident serves cached (even stale) responses and
            <strong> defers purges into a queue</strong> instead of evicting. Disabling replays (or drops) the queue
            and resumes normal behaviour. Configure defaults in <code className="mono">[cache.reflect]</code>; the
            auto-disable deadline above caps how long it stays on.
          </p>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {MODES.map((m) => (
              <div key={m.name} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Badge variant="accent">{m.name}</Badge>
                <span className="text-muted" style={{ fontSize: 12.5 }}>{m.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
