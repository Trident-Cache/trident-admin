'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WarmerStatusResponse } from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, Progress, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatBytes } from '@/lib/format';

type ActionResult = { ok: boolean; message: string } | null;

function parseUrlList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n|,/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

export default function WarmerPage() {
  const [status, setStatus] = useState<WarmerStatusResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);

  // queue form
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [text, setText] = useState('');
  const [sitemapText, setSitemapText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const urls = parseUrlList(text);
  const running = status?.state === 'running';

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/warmer/status'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `status ${res.status}`);
      setStatus(data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load warmer status');
    }
  }, []);

  // poll: every 1.5s while running, 5s otherwise
  useEffect(() => {
    load();
    const ms = running ? 1500 : 5000;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, running]);

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

  const onRun = async () => {
    try {
      const sitemaps = sitemapText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const d = await post('/api/warmer/run', 'run', { sitemaps });
      setResult({
        ok: true,
        message: `Started — ${d.queued ?? 0} URLs queued from ${sitemaps.length ? `${sitemaps.length} sitemap(s)` : 'configured sources'}.`,
      });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onCancel = async () => {
    try {
      const d = await post('/api/warmer/cancel', 'cancel');
      setResult({ ok: true, message: `Cancelled — ${d.cancelledTotal ?? 0} pending URLs drained.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onQueue = async () => {
    if (urls.length === 0) return;
    try {
      const d = await post('/api/warmer/queue', 'queue', { urls });
      setResult({ ok: true, message: `Queued ${d.received ?? urls.length} URLs for warming.` });
      setText('');
      setFileName(null);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(f);
  };

  const cur = status?.currentRun;
  const last = status?.lastRun;

  return (
    <>
      <PageHead
        title="Cache Warmer"
        sub="Proactively populate the cache from sitemaps and URL lists — on a schedule or on demand."
        actions={
          <>
            <input
              className="input"
              style={{ minWidth: 280 }}
              placeholder="Sitemap URL (optional, .xml or .xml.gz)"
              value={sitemapText}
              onChange={(e) => setSitemapText(e.target.value)}
              aria-label="Sitemap URL to warm from"
            />
            <button className="btn btn-primary" onClick={onRun} disabled={!status?.enabled || running || busy != null}>
              <Icon name="play" size={14} /> {busy === 'run' ? 'Starting…' : 'Run now'}
            </button>
            <button className="btn btn-danger" onClick={onCancel} disabled={!running || busy != null}>
              <Icon name="pause" size={14} /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel run'}
            </button>
          </>
        }
      />

      {loadErr && <div className="banner banner-danger" style={{ marginBottom: 16 }}>Cannot reach warmer API: {loadErr}</div>}

      {status && !status.enabled && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} />
          <span>
            The cache warmer is <strong>disabled</strong>. Enable it in <code className="mono">trident.toml</code> under{' '}
            <code className="mono">[cache.warmer]</code> (set <code className="mono">enabled = true</code> + a{' '}
            <code className="mono">[[cache.warmer.source]]</code>), then reload config. See the Warmer HOWTO.
          </span>
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      {/* Status tiles */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard
          label="State"
          value={
            <Badge variant={running ? 'accent' : status?.state === 'paused_for_launch' ? 'warn' : 'default'} dot>
              {status?.state ?? '—'}
            </Badge>
          }
          hint={status?.enabled ? 'enabled' : 'disabled'}
        />
        <StatCard label="In-flight" value={cur ? `${cur.completed}/${cur.total}` : '—'} hint={cur ? `${cur.failed} failed` : 'idle'} />
        <StatCard label="Bytes cached" value={cur ? formatBytes(cur.bytesCached) : last ? formatBytes(last.bytesCached) : '—'} hint={cur ? 'this run' : 'last run'} />
        <StatCard
          label="Schedule"
          value={<span className="mono" style={{ fontSize: 15 }}>{status?.schedule?.mode ?? '—'}</span>}
          hint={status?.schedule?.value || (status?.nextScheduledRun ? `next: ${status.nextScheduledRun}` : 'on-demand')}
        />
      </div>

      {/* Live progress */}
      {cur && (
        <Card title={<><Icon name="warmer" size={14} /> Current run</>} sub={`${cur.percent.toFixed(1)}% complete`} className="col-span-3" >
          <div style={{ marginBottom: 12 }}>
            <Progress value={cur.percent} variant={cur.failed > 0 ? 'warn' : undefined} />
          </div>
          <div className="row" style={{ gap: 24, fontSize: 13 }}>
            <span><strong className="tnum">{cur.completed}</strong> <span className="text-subtle">completed</span></span>
            <span><strong className="tnum">{cur.total}</strong> <span className="text-subtle">total</span></span>
            <span className="text-danger"><strong className="tnum">{cur.failed}</strong> failed</span>
            <span><strong className="tnum">{formatBytes(cur.bytesCached)}</strong> <span className="text-subtle">cached</span></span>
          </div>
        </Card>
      )}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        {/* Queue form */}
        <Card
          title={<><Icon name="queue" size={14} /> Queue URLs</>}
          sub="Paste a URL list or upload a .txt/.csv file (one URL per line)."
          actions={
            <div className="seg">
              <button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>Paste</button>
              <button className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload</button>
            </div>
          }
        >
          {mode === 'upload' && (
            <div style={{ marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" onChange={onFile} style={{ display: 'none' }} />
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Icon name="download" size={14} /> Choose file…
              </button>
              {fileName && <span className="text-subtle mono" style={{ marginLeft: 10, fontSize: 12 }}>{fileName}</span>}
            </div>
          )}
          <textarea
            className="input mono"
            rows={mode === 'upload' ? 6 : 9}
            placeholder={'https://example.com/\nhttps://example.com/products\n# comment lines are ignored'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ resize: 'vertical', lineHeight: 1.6 }}
          />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <span className="text-subtle" style={{ fontSize: 12.5 }}>
              <strong className="tnum">{urls.length}</strong> URL{urls.length === 1 ? '' : 's'} parsed
            </span>
            <button className="btn btn-primary" onClick={onQueue} disabled={urls.length === 0 || busy != null || !status?.enabled}>
              <Icon name="plus" size={14} /> {busy === 'queue' ? 'Queuing…' : `Queue ${urls.length || ''} URL${urls.length === 1 ? '' : 's'}`.trim()}
            </button>
          </div>
        </Card>

        {/* Last run */}
        <Card title={<><Icon name="stats" size={14} /> Last run</>} sub={last?.completedAt ? `finished ${last.completedAt}` : 'no completed run yet'}>
          {last ? (
            <table className="table">
              <tbody>
                <tr><td className="muted">Result</td><td className="right">{last.cancelled ? <Badge variant="warn">cancelled</Badge> : <Badge variant="success">completed</Badge>}</td></tr>
                <tr><td className="muted">Completed</td><td className="right num">{last.completed} / {last.total}</td></tr>
                <tr><td className="muted">Failed</td><td className="right num">{last.failed}</td></tr>
                <tr><td className="muted">Skipped (uncacheable)</td><td className="right num">{last.skippedUncacheable}</td></tr>
                <tr><td className="muted">Bytes cached</td><td className="right num">{formatBytes(last.bytesCached)}</td></tr>
                <tr><td className="muted">Duration</td><td className="right num">{(last.durationMs / 1000).toFixed(1)}s</td></tr>
              </tbody>
            </table>
          ) : (
            <div className="text-subtle" style={{ padding: '8px 0', fontSize: 13 }}>Run the warmer to see results here.</div>
          )}
        </Card>
      </div>
    </>
  );
}
