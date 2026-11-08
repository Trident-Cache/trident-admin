'use client';

import { useMemo, useState } from 'react';
import type { PurgeResponse } from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatNumber } from '@/lib/format';

type Mode = 'url' | 'tags' | 'host' | 'pattern' | 'vary' | 'all';
type Result = { ok: boolean; message: string; count?: number } | null;

const MODES: { id: Mode; label: string; icon: Parameters<typeof Icon>[0]['name']; desc: string }[] = [
  { id: 'url', label: 'By URL', icon: 'cache', desc: 'Purge a single cached URL (optionally scoped to a host).' },
  { id: 'tags', label: 'By Tag(s)', icon: 'filter', desc: 'Purge every entry tagged with one or more cache tags.' },
  { id: 'host', label: 'By Host', icon: 'dns', desc: 'Purge all cached entries belonging to a host.' },
  { id: 'pattern', label: 'By Pattern', icon: 'search', desc: 'Purge entries matching a URL regex or a tag wildcard/regex pattern.' },
  { id: 'vary', label: 'By Vary', icon: 'denoise', desc: 'Purge a Vary dimension — e.g. a customer group or encoding.' },
  { id: 'all', label: 'Purge All', icon: 'trash', desc: 'Flush the entire cache. Destructive — requires confirmation.' },
];

function splitTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const t = raw.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export default function PurgePage() {
  const [mode, setMode] = useState<Mode>('url');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [ops, setOps] = useState(0);
  const [soft, setSoft] = useState(false);

  // by URL
  const [url, setUrl] = useState('');
  const [urlHost, setUrlHost] = useState('');
  // by tags
  const [tagsText, setTagsText] = useState('');
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');
  // by host
  const [host, setHost] = useState('');
  // by pattern
  const [patternKind, setPatternKind] = useState<'url' | 'tag'>('url');
  const [pattern, setPattern] = useState('');
  const [tagPatternType, setTagPatternType] = useState<'wildcard' | 'regex'>('wildcard');
  // by vary
  const [varyHeader, setVaryHeader] = useState('');
  const [varyValue, setVaryValue] = useState('');
  // purge all
  const [confirmAll, setConfirmAll] = useState('');

  const tags = useMemo(() => splitTags(tagsText), [tagsText]);
  const activeMode = MODES.find((m) => m.id === mode)!;

  const post = async (path: string, body?: unknown): Promise<PurgeResponse> => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
      return data as PurgeResponse;
    } finally {
      setBusy(false);
    }
  };

  const finish = (d: PurgeResponse, label: string) => {
    const count = typeof d.purgedCount === 'number' ? d.purgedCount : 0;
    setLastCount(count);
    setOps((n) => n + 1);
    setResult({
      ok: d.success !== false,
      message: d.message || `${label} — ${formatNumber(count)} ${count === 1 ? 'entry' : 'entries'} ${soft ? 'marked stale' : 'purged'}.`,
      count,
    });
  };

  const fail = (e: unknown) => setResult({ ok: false, message: e instanceof Error ? e.message : 'purge failed' });

  const run = async () => {
    try {
      if (mode === 'url') {
        if (!url.trim()) return;
        finish(await post('/api/purge/url', { url: url.trim(), host: urlHost.trim() || undefined, soft }), 'URL purged');
      } else if (mode === 'tags') {
        if (tags.length === 0) return;
        finish(await post('/api/purge/tags', { tags, matchMode }), `Tags purged (${matchMode === 'all' ? 'AND' : 'OR'})`);
      } else if (mode === 'host') {
        if (!host.trim()) return;
        finish(await post('/api/purge/host', { host: host.trim(), soft }), 'Host purged');
      } else if (mode === 'pattern') {
        if (!pattern.trim()) return;
        const body = patternKind === 'url'
          ? { type: 'url', pattern: pattern.trim(), soft }
          : { type: 'tag', pattern: pattern.trim(), patternType: tagPatternType };
        finish(await post('/api/purge/pattern', body), `${patternKind === 'url' ? 'URL' : 'Tag'} pattern purged`);
      } else if (mode === 'vary') {
        if (!varyHeader.trim() || !varyValue.trim()) return;
        finish(await post('/api/purge/vary', { header: varyHeader.trim(), value: varyValue.trim(), soft }), 'Vary dimension purged');
      } else if (mode === 'all') {
        if (confirmAll.trim().toUpperCase() !== 'PURGE ALL') return;
        finish(await post('/api/purge/all'), 'Entire cache flushed');
        setConfirmAll('');
      }
    } catch (e) {
      fail(e);
    }
  };

  const supportsSoft = mode === 'url' || mode === 'host' || mode === 'vary' || (mode === 'pattern' && patternKind === 'url');

  return (
    <>
      <PageHead
        title="Purge Console"
        sub="Invalidate cached responses by URL, tag, host, pattern, or Vary dimension — or flush everything."
      />

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <StatCard label="Last purge" value={lastCount != null ? formatNumber(lastCount) : '—'} unit={lastCount != null ? 'entries' : undefined} hint="affected" />
        <StatCard label="Purges this session" value={formatNumber(ops)} hint="operations run" />
        <StatCard label="Mode" value={<Badge variant="accent">{activeMode.label}</Badge>} hint={soft && supportsSoft ? 'soft' : 'hard'} />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card
          title={<><Icon name={activeMode.icon} size={14} /> {activeMode.label}</>}
          sub={activeMode.desc}
          actions={supportsSoft ? (
            <div className="seg">
              <button className={!soft ? 'active' : ''} onClick={() => setSoft(false)}>Hard</button>
              <button className={soft ? 'active' : ''} onClick={() => setSoft(true)}>Soft</button>
            </div>
          ) : undefined}
        >
          <label className="label-text">Purge by</label>
          <div className="seg" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => { setMode(m.id); setResult(null); }}>
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'url' && (
            <>
              <label className="label-text">URL</label>
              <input className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/products/123 or https://example.com/page" />
              <p className="help-text">Absolute or path-only. The matching cached entry is invalidated.</p>
              <label className="label-text" style={{ marginTop: 12 }}>Host (optional)</label>
              <input className="input mono" value={urlHost} onChange={(e) => setUrlHost(e.target.value)} placeholder="example.com" />
              <p className="help-text">Scope the purge to a specific host when the URL is path-only.</p>
            </>
          )}

          {mode === 'tags' && (
            <>
              <label className="label-text">Tags</label>
              <textarea
                className="input mono"
                rows={4}
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder={'cat_12 product_445 cms-block-home\nspace, comma or newline separated'}
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
              <p className="help-text"><strong className="tnum">{tags.length}</strong> tag{tags.length === 1 ? '' : 's'} parsed.</p>
              <label className="label-text" style={{ marginTop: 12 }}>Match mode</label>
              <div className="seg">
                <button className={matchMode === 'any' ? 'active' : ''} onClick={() => setMatchMode('any')}>Any (OR)</button>
                <button className={matchMode === 'all' ? 'active' : ''} onClick={() => setMatchMode('all')}>All (AND)</button>
              </div>
              <p className="help-text">{matchMode === 'any' ? 'Purge entries carrying any of the tags.' : 'Purge only entries carrying all of the tags.'}</p>
            </>
          )}

          {mode === 'host' && (
            <>
              <label className="label-text">Host</label>
              <input className="input mono" value={host} onChange={(e) => setHost(e.target.value)} placeholder="shop.example.com" />
              <p className="help-text">Every cached entry for this host is invalidated.</p>
            </>
          )}

          {mode === 'pattern' && (
            <>
              <label className="label-text">Pattern target</label>
              <div className="seg" style={{ marginBottom: 12 }}>
                <button className={patternKind === 'url' ? 'active' : ''} onClick={() => setPatternKind('url')}>URL regex</button>
                <button className={patternKind === 'tag' ? 'active' : ''} onClick={() => setPatternKind('tag')}>Tag pattern</button>
              </div>
              <label className="label-text">{patternKind === 'url' ? 'URL regex' : 'Tag pattern'}</label>
              <input
                className="input mono"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={patternKind === 'url' ? '^/products/.*\\.html$' : 'cat_*'}
              />
              {patternKind === 'tag' ? (
                <>
                  <label className="label-text" style={{ marginTop: 12 }}>Pattern type</label>
                  <div className="seg">
                    <button className={tagPatternType === 'wildcard' ? 'active' : ''} onClick={() => setTagPatternType('wildcard')}>Wildcard</button>
                    <button className={tagPatternType === 'regex' ? 'active' : ''} onClick={() => setTagPatternType('regex')}>Regex</button>
                  </div>
                  <p className="help-text">Wildcard uses <code className="mono">*</code> globbing; regex matches the full tag.</p>
                </>
              ) : (
                <p className="help-text">A regular expression matched against cached URLs.</p>
              )}
            </>
          )}

          {mode === 'vary' && (
            <>
              <label className="label-text">Vary dimension</label>
              <input className="input mono" value={varyHeader} onChange={(e) => setVaryHeader(e.target.value)} placeholder="cookie:x-magento-vary" />
              <p className="help-text">Header / cookie name that produced the Vary axis (e.g. <code className="mono">accept-encoding</code>).</p>
              <label className="label-text" style={{ marginTop: 12 }}>Value to match</label>
              <input className="input mono" value={varyValue} onChange={(e) => setVaryValue(e.target.value)} placeholder="group1" />
              <p className="help-text">Only entries cached under this dimension value are purged.</p>
            </>
          )}

          {mode === 'all' && (
            <>
              <div className="banner banner-warn" style={{ marginBottom: 12 }}>
                <Icon name="info" size={16} />
                <span>This flushes <strong>every</strong> cached entry across all hosts. There is no undo.</span>
              </div>
              <label className="label-text">Type <code className="mono">PURGE ALL</code> to confirm</label>
              <input className="input mono" value={confirmAll} onChange={(e) => setConfirmAll(e.target.value)} placeholder="PURGE ALL" />
              <p className="help-text">The flush button stays disabled until the confirmation text matches.</p>
            </>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            {mode === 'all' ? (
              <button
                className="btn btn-danger"
                onClick={run}
                disabled={busy || confirmAll.trim().toUpperCase() !== 'PURGE ALL'}
              >
                <Icon name="trash" size={14} /> {busy ? 'Flushing…' : 'Flush entire cache'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={run} disabled={busy}>
                <Icon name="purge" size={14} /> {busy ? 'Purging…' : `Purge ${soft && supportsSoft ? '(soft)' : ''}`.trim()}
              </button>
            )}
          </div>
        </Card>

        <div className="col" style={{ gap: 16 }}>
          <Card title={<><Icon name="info" size={14} /> How purging works</>}>
            <p style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.65 }}>
              Each purge mode targets a different index. <strong>Hard</strong> deletes entries immediately;{' '}
              <strong>soft</strong> marks them stale so they can still be served while-revalidate. Tag and host purges
              fan out across every matching variant; <code className="mono">By Vary</code> targets a single cache axis
              such as a customer group or encoding.
            </p>
            <div className="col" style={{ gap: 8, marginTop: 12 }}>
              {MODES.map((m) => (
                <div key={m.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Badge variant={m.id === 'all' ? 'danger' : 'accent'}>{m.label}</Badge>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>{m.desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={<><Icon name="stats" size={14} /> Last result</>} sub="Most recent purge from this console.">
            {lastCount != null ? (
              <div className="table-wrapper">
                <table className="table">
                  <tbody>
                    <tr><td className="muted">Entries affected</td><td className="right tnum">{formatNumber(lastCount)}</td></tr>
                    <tr><td className="muted">Mode</td><td className="right">{activeMode.label}</td></tr>
                    <tr><td className="muted">Type</td><td className="right">{soft && supportsSoft ? <Badge variant="warn">soft</Badge> : <Badge variant="success">hard</Badge>}</td></tr>
                    <tr><td className="muted">Operations this session</td><td className="right tnum">{formatNumber(ops)}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No purges run yet this session.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
