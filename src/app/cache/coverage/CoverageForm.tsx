'use client';

import { useState } from 'react';
import { Card, Progress } from '@/components/ui/primitives';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiUrl } from '@/lib/format';

interface CoverageEntry {
  url: string;
  cached: boolean;
  status?: string;
  ageS?: number;
  ttlS?: number;
  size?: number;
}

interface CoverageResult {
  total: number;
  cached: number;
  uncached: number;
  percentCached: number;
  results: CoverageEntry[];
}

type Filter = 'all' | 'cached' | 'uncached';

export function CoverageForm() {
  const [urls, setUrls] = useState('');
  const [host, setHost] = useState('');
  const [scheme, setScheme] = useState<'https' | 'http'>('https');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const check = async () => {
    const list = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError('Enter at least one URL');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/cache/coverage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: list, host: host || undefined, scheme }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data as CoverageResult);
      } else {
        setError(data.error || 'Coverage check failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const shown =
    result?.results.filter((r) =>
      filter === 'all' ? true : filter === 'cached' ? r.cached : !r.cached,
    ) ?? [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="URL set">
        <div style={{ display: 'grid', gap: 12 }}>
          <textarea
            className="input"
            rows={8}
            placeholder={'/\n/products\nhttps://shop.example/cart'}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            style={{ fontFamily: 'monospace', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input"
              placeholder="host (optional, e.g. shop.example)"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
            <select
              className="input"
              value={scheme}
              onChange={(e) => setScheme(e.target.value as 'https' | 'http')}
            >
              <option value="https">https</option>
              <option value="http">http</option>
            </select>
            <button className="btn btn-primary" disabled={loading} onClick={check}>
              {loading ? 'Checking…' : 'Check coverage'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </div>
      </Card>

      {result && (
        <Card
          title={`${result.percentCached}% cached`}
          sub={`${result.cached} of ${result.total} cached · ${result.uncached} missing`}
          actions={
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'cached', 'uncached'] as const).map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        >
          <div style={{ marginBottom: 12 }}>
            <Progress value={result.percentCached} />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Cached</th>
                <th>Status</th>
                <th>Age (s)</th>
                <th>TTL (s)</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.url}>
                  <td style={{ fontFamily: 'monospace' }}>{r.url}</td>
                  <td style={{ color: r.cached ? 'var(--ok, #1a7f37)' : 'var(--danger, #cc0000)' }}>
                    {r.cached ? 'yes' : 'no'}
                  </td>
                  <td>{r.status ?? '—'}</td>
                  <td>{r.ageS ?? '—'}</td>
                  <td>{r.ttlS ?? '—'}</td>
                  <td>{r.size ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
