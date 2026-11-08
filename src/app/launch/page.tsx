'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaunchStatusResponse } from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, Progress, StatCard } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

type Result = { ok: boolean; message: string } | null;

function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n|,/)) {
    const line = raw.trim();
    if (line && !line.startsWith('#') && !seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

export default function LaunchPage() {
  const [status, setStatus] = useState<LaunchStatusResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  // start form
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('We’ll be right back');
  const [message, setMessage] = useState('Site maintenance in progress — back shortly.');
  const [autoComplete, setAutoComplete] = useState(true);
  const [bypassIps, setBypassIps] = useState('');

  const urls = parseList(text);
  const active = status?.active === true;
  const enabled = status ? status.state !== 'disabled' : true;

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/launch/status'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `status ${res.status}`);
      setStatus(data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load launch status');
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

  const onStart = async () => {
    if (urls.length === 0) return;
    const body = {
      urls,
      maintenance: { title, message },
      autoComplete,
      bypassIps: parseList(bypassIps),
    };
    try {
      const d = await post('/api/launch/start', 'start', body);
      setResult({ ok: d.success !== false, message: d.message || `Launch started — warming ${d.totalUrls ?? urls.length} URLs behind the maintenance page.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onComplete = async () => {
    try {
      const d = await post('/api/launch/complete', 'complete');
      setResult({ ok: true, message: d.message || `Launch completed — site is live (${d.urlsWarmed ?? 0} warmed).` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onAbort = async () => {
    try {
      const d = await post('/api/launch/abort', 'abort', { reason: 'aborted from admin panel' });
      setResult({ ok: true, message: d.message || 'Launch aborted.' });
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

  const p = status?.progress;

  return (
    <>
      <PageHead
        title="Launch Mode"
        sub="Serve a maintenance page (with IP/path bypass) while warming a URL set, then go live."
        actions={
          active ? (
            <>
              <button className="btn btn-primary" onClick={onComplete} disabled={busy != null}>
                <Icon name="check" size={14} /> {busy === 'complete' ? 'Going live…' : 'Complete (go live)'}
              </button>
              <button className="btn btn-danger" onClick={onAbort} disabled={busy != null}>
                <Icon name="close" size={14} /> {busy === 'abort' ? 'Aborting…' : 'Abort'}
              </button>
            </>
          ) : undefined
        }
      />

      {loadErr && <div className="banner banner-danger" style={{ marginBottom: 16 }}>Cannot reach launch API: {loadErr}</div>}

      {status && !enabled && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} />
          <span>Launch mode is <strong>disabled</strong>. Enable <code className="mono">[launch] enabled = true</code> in <code className="mono">trident.toml</code> and reload config. See the Launch HOWTO.</span>
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard label="Status" value={<Badge variant={active ? 'accent' : 'default'} dot>{active ? 'active' : 'inactive'}</Badge>} hint={status?.state ?? '—'} />
        <StatCard label="Progress" value={p ? `${p.completed}/${p.total}` : '—'} hint={p ? `${p.failed} failed` : 'no active launch'} />
        <StatCard label="Percent" value={p ? p.percent.toFixed(0) : '—'} unit={p ? '%' : undefined} />
        <StatCard label="Started" value={<span className="mono" style={{ fontSize: 13 }}>{status?.startedAt ?? '—'}</span>} />
      </div>

      {active && p && (
        <Card title={<><Icon name="launch" size={14} /> Warming in progress</>} sub={`${p.percent.toFixed(1)}% — maintenance page served to everyone except bypass`}>
          <Progress value={p.percent} variant={p.failed > 0 ? 'warn' : undefined} />
          <div className="row" style={{ gap: 24, fontSize: 13, marginTop: 12 }}>
            <span><strong className="tnum">{p.completed}</strong> <span className="text-subtle">warmed</span></span>
            <span><strong className="tnum">{p.total}</strong> <span className="text-subtle">total</span></span>
            <span className="text-danger"><strong className="tnum">{p.failed}</strong> failed</span>
          </div>
        </Card>
      )}

      {!active && (
        <Card
          title={<><Icon name="play" size={14} /> Start a launch</>}
          sub="Warm these URLs behind a maintenance page, then go live."
          actions={
            <div className="row" style={{ gap: 12 }}>
              <input ref={fileRef} type="file" accept=".txt,.csv" onChange={onFile} style={{ display: 'none' }} />
              <button className="btn btn-sm" onClick={() => fileRef.current?.click()}><Icon name="download" size={14} /> Upload list</button>
              {fileName && <span className="text-subtle mono" style={{ fontSize: 12 }}>{fileName}</span>}
            </div>
          }
        >
          <label className="label-text">URLs to warm ({urls.length})</label>
          <textarea className="input mono" rows={7} placeholder={'https://shop.example.com/\nhttps://shop.example.com/category/shoes'} value={text} onChange={(e) => setText(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.6 }} />

          <div className="grid-2" style={{ marginTop: 14 }}>
            <div>
              <label className="label-text">Maintenance title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Bypass IPs (comma/line separated)</label>
              <input className="input mono" value={bypassIps} onChange={(e) => setBypassIps(e.target.value)} placeholder="203.0.113.4, 198.51.100.0/24" />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="label-text">Maintenance message</label>
            <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoComplete} onChange={(e) => setAutoComplete(e.target.checked)} />
              Auto-complete (go live automatically when warming finishes)
            </label>
            <button className="btn btn-primary" onClick={onStart} disabled={urls.length === 0 || busy != null || !enabled}>
              <Icon name="launch" size={14} /> {busy === 'start' ? 'Starting…' : `Start launch (${urls.length})`}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
