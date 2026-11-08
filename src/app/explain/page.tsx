'use client';

import { useState } from 'react';
import type { ExplainResponse } from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl } from '@/lib/format';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

const VERDICT_VARIANT: Record<string, 'success' | 'warn' | 'default'> = {
  hit: 'success',
  miss: 'warn',
  pass: 'default',
};

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) {
      const name = line.slice(0, i).trim();
      if (name) out[name] = line.slice(i + 1).trim();
    }
  }
  return out;
}

export default function ExplainPage() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [detail, setDetail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ExplainResponse | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      const r = await fetch(apiUrl('/api/explain'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, url: url.trim(), headers: parseHeaders(headersText), detail }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `request failed (${r.status})`);
      setRes(data as ExplainResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'explain failed');
    } finally {
      setBusy(false);
    }
  };

  const entry = res?.entry;

  return (
    <>
      <PageHead
        title="Explain"
        sub="Dry-run a request against the live cache policy — will it hit, miss, or pass, and why? Read-only: never mutates the cache, telemetry, or denoiser state."
      />

      {error && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> {error}
        </div>
      )}

      {res && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
          <StatCard
            label="Verdict"
            value={<Badge variant={VERDICT_VARIANT[res.verdict] ?? 'default'}>{res.verdict.toUpperCase()}</Badge>}
            hint={res.cacheable ? 'cache-eligible' : 'not cache-eligible'}
          />
          <StatCard
            label="Visibility"
            value={<Badge variant={res.visibility === 'public' ? 'info' : 'accent'}>{res.visibility}</Badge>}
            hint="content scope"
          />
          <StatCard label="Reason" value={<span className="mono" style={{ fontSize: 13 }}>{res.reason}</span>} hint="why" />
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card
          title={<><Icon name="search" size={14} /> Request</>}
          sub="Simulate a request. Add headers (Host, Cookie, Authorization…) to test private or segmented paths."
        >
          <label className="label-text">Method</label>
          <div className="seg" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            {METHODS.map((m) => (
              <button key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>

          <label className="label-text">URL</label>
          <input
            className="input mono"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
            placeholder="/products/42 or https://shop.example.com/page?a=1"
          />
          <p className="help-text">Absolute or path-only. The Host used for key lookup comes from a Host header below (if any).</p>

          <label className="label-text" style={{ marginTop: 12 }}>Headers (optional)</label>
          <textarea
            className="input mono"
            rows={4}
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            placeholder={'Host: shop.example.com\nCookie: PHPSESSID=abc; X-Magento-Vary=grp1\nAuthorization: Bearer …'}
            style={{ resize: 'vertical', lineHeight: 1.6 }}
          />
          <p className="help-text">One <code>Name: Value</code> per line.</p>

          <label style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
            <span className="label-text" style={{ margin: 0 }}>Include cache key, entry &amp; denoiser detail</span>
          </label>

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={run} disabled={busy || !url.trim()}>
              {busy ? 'Explaining…' : 'Explain'}
            </button>
          </div>
        </Card>

        <Card title={<><Icon name="info" size={14} /> Result</>} sub="The live cacheability decision for this request.">
          {!res && <p className="help-text">Submit a request to see the decision.</p>}
          {res && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="label-text">Decision</span>
                <div>
                  <Badge variant={VERDICT_VARIANT[res.verdict] ?? 'default'}>{res.verdict.toUpperCase()}</Badge>
                  <span className="help-text" style={{ marginLeft: 8 }}>{res.reason}</span>
                </div>
              </div>

              {res.cache_key && (
                <div>
                  <span className="label-text">Cache key</span>
                  <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{res.cache_key.hash}</div>
                  <div className="help-text mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{res.cache_key.components}</div>
                </div>
              )}

              {entry && (
                <div>
                  <span className="label-text">Cached entry</span>
                  {!entry.present ? (
                    <p className="help-text">No entry currently cached for this key.</p>
                  ) : (
                    <div className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
                      {entry.age_secs != null && <div>age: {entry.age_secs}s</div>}
                      {entry.ttl_remaining_secs != null && <div>ttl remaining: {entry.ttl_remaining_secs}s</div>}
                      {entry.size_bytes != null && <div>size: {entry.size_bytes} B</div>}
                      {entry.etag && <div>etag: {entry.etag}</div>}
                      {entry.cache_control && <div>cache-control: {entry.cache_control}</div>}
                      {entry.tags && entry.tags.length > 0 && <div>tags: {entry.tags.join(', ')}</div>}
                      {entry.vary && entry.vary.length > 0 && <div>vary: {entry.vary.join(', ')}</div>}
                    </div>
                  )}
                </div>
              )}

              {res.denoiser != null && (
                <div>
                  <span className="label-text">Denoiser</span>
                  <pre
                    className="mono"
                    style={{ fontSize: 11, background: 'rgba(120,120,140,0.08)', padding: 10, borderRadius: 6, overflow: 'auto', margin: 0 }}
                  >{JSON.stringify(res.denoiser, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
