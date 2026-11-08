'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LaunchProgress } from '@/components/features/LaunchProgress';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { apiUrl } from '@/lib/format';

interface LaunchState {
  launchId: string;
  status: 'warming' | 'ready' | 'completed' | 'aborted';
  urlsTotal: number;
  urlsWarmed: number;
  urlsFailed: number;
  startedAt: string;
}

export function LaunchStartForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'urls' | 'sitemap'>('urls');
  const [urls, setUrls] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [concurrency, setConcurrency] = useState(10);
  const [autoComplete, setAutoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        options: { concurrency, autoComplete },
      };
      if (mode === 'urls') {
        body.urls = urls.split('\n').map((u) => u.trim()).filter(Boolean);
      } else {
        body.sitemapUrl = sitemapUrl;
      }

      const res = await fetch(apiUrl('/api/launch/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setLaunchState({
          launchId: data.launchId,
          status: 'warming',
          urlsTotal: 0,
          urlsWarmed: 0,
          urlsFailed: 0,
          startedAt: new Date().toISOString(),
        });
      } else {
        setError(data.error || data.message || 'Failed to start launch');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (launchState) {
    return <LaunchProgress launchId={launchState.launchId} initialStatus={launchState} />;
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Mode</label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === 'urls'} onChange={() => setMode('urls')} />
            URL List
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode === 'sitemap'} onChange={() => setMode('sitemap')} />
            Sitemap URL
          </label>
        </div>
      </div>

      {mode === 'urls' ? (
        <div>
          <label className="label">URLs (one per line)</label>
          <textarea
            className="input mt-1"
            rows={8}
            placeholder={'https://example.com/\nhttps://example.com/about\nhttps://example.com/products'}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
        </div>
      ) : (
        <div>
          <label className="label">Sitemap URL</label>
          <input
            className="input mt-1"
            placeholder="https://example.com/sitemap.xml"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Concurrency</label>
          <input
            type="number"
            className="input mt-1"
            min={1}
            max={100}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoComplete}
              onChange={(e) => setAutoComplete(e.target.checked)}
            />
            Auto-complete when ready
          </label>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      <button className="btn-primary" disabled={loading} onClick={handleStart}>
        {loading ? 'Starting...' : 'Start Launch'}
      </button>
    </div>
  );
}
