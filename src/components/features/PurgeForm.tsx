'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { apiUrl } from '@/lib/format';

interface PurgeResult {
  success: boolean;
  purgedCount?: number;
  message?: string;
  error?: string;
}

function useFormAction() {
  const router = useRouter();
  const [result, setResult] = useState<PurgeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (url: string, body: Record<string, unknown>) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl(url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, purgedCount: data.purgedCount, message: data.message });
        router.refresh();
      } else {
        setResult({ success: false, error: data.error || 'Request failed' });
      }
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, submit };
}

function ResultDisplay({ result }: { result: PurgeResult | null }) {
  if (!result) return null;
  if (result.success) {
    return <SuccessAlert message={`Purged ${result.purgedCount ?? 0} entries. ${result.message || ''}`} />;
  }
  return <ErrorAlert message={result.error || 'Unknown error'} />;
}

function UrlTab() {
  const { result, loading, submit } = useFormAction();
  const [url, setUrl] = useState('');
  const [host, setHost] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">URL Path</label>
        <input className="input mt-1" placeholder="/path/to/page" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <label className="label">Host (optional)</label>
        <input className="input mt-1" placeholder="example.com" value={host} onChange={(e) => setHost(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={loading || !url} onClick={() => submit('/api/purge/url', { url, host: host || undefined })}>
        {loading ? 'Purging...' : 'Purge URL'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function BulkUrlsTab() {
  const { result, loading, submit } = useFormAction();
  const [urls, setUrls] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">URLs (one per line)</label>
        <textarea className="input mt-1" rows={6} placeholder={'/page1\n/page2\n/page3'} value={urls} onChange={(e) => setUrls(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={loading || !urls.trim()} onClick={() => submit('/api/purge/bulk', { urls: urls.split('\n').map((u) => u.trim()).filter(Boolean) })}>
        {loading ? 'Purging...' : 'Purge URLs'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function TagsTab() {
  const { result, loading, submit } = useFormAction();
  const [tags, setTags] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Tags (comma-separated)</label>
        <input className="input mt-1" placeholder="tag1, tag2, tag3" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={loading || !tags.trim()} onClick={() => submit('/api/purge/tags', { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}>
        {loading ? 'Purging...' : 'Purge by Tags'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function TagPatternTab() {
  const { result, loading, submit } = useFormAction();
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<'wildcard' | 'regex'>('wildcard');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Tag Pattern</label>
        <input className="input mt-1" placeholder="product-*" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </div>
      <div>
        <label className="label">Pattern Type</label>
        <select className="select mt-1" value={patternType} onChange={(e) => setPatternType(e.target.value as 'wildcard' | 'regex')}>
          <option value="wildcard">Wildcard</option>
          <option value="regex">Regex</option>
        </select>
      </div>
      <button className="btn-primary" disabled={loading || !pattern.trim()} onClick={() => submit('/api/purge/pattern', { pattern, patternType })}>
        {loading ? 'Purging...' : 'Purge by Pattern'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function UrlPatternTab() {
  const { result, loading, submit } = useFormAction();
  const [pattern, setPattern] = useState('');
  const [preview, setPreview] = useState<{ wouldPurge: number; entries: { url: string; host: string }[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(apiUrl('/api/purge/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, type: 'url' }),
      });
      const data = await res.json();
      setPreview(data);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">URL Pattern (regex)</label>
        <input className="input mt-1" placeholder="/products/.*" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={previewLoading || !pattern.trim()} onClick={handlePreview}>
          {previewLoading ? 'Loading...' : 'Preview'}
        </button>
        <button className="btn-primary" disabled={loading || !pattern.trim()} onClick={() => submit('/api/purge/pattern', { pattern, type: 'url' })}>
          {loading ? 'Purging...' : 'Purge by URL Pattern'}
        </button>
      </div>
      {preview && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="font-medium text-gray-700">Would purge {preview.wouldPurge} entries:</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
            {preview.entries.map((e, i) => (
              <li key={i}>{e.host}{e.url}</li>
            ))}
          </ul>
        </div>
      )}
      <ResultDisplay result={result} />
    </div>
  );
}

function HostTab() {
  const { result, loading, submit } = useFormAction();
  const [host, setHost] = useState('');
  const [soft, setSoft] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Host</label>
        <input className="input mt-1" placeholder="example.com" value={host} onChange={(e) => setHost(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={soft} onChange={(e) => setSoft(e.target.checked)} />
        Soft purge (mark stale, keep for grace period)
      </label>
      <button className="btn-primary" disabled={loading || !host.trim()} onClick={() => submit('/api/purge/host', { host, soft })}>
        {loading ? 'Purging...' : 'Purge by Host'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function VaryTab() {
  const { result, loading, submit } = useFormAction();
  const [header, setHeader] = useState('');
  const [value, setValue] = useState('');
  const [soft, setSoft] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        Purge entries by Vary dimension. Examples: <code>cookie:x-magento-vary</code> = <code>group1</code> to clear a customer group;
        <code> accept-encoding</code> = <code>gzip</code> to clear all gzipped variants.
      </div>
      <div>
        <label className="label">Vary header</label>
        <input className="input mt-1" placeholder="cookie:x-magento-vary" value={header} onChange={(e) => setHeader(e.target.value)} />
      </div>
      <div>
        <label className="label">Value</label>
        <input className="input mt-1" placeholder="group1" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={soft} onChange={(e) => setSoft(e.target.checked)} />
        Soft purge (mark stale, keep for grace period)
      </label>
      <button
        className="btn-primary"
        disabled={loading || !header.trim() || !value.trim()}
        onClick={() => submit('/api/purge/vary', { header, value, soft })}
      >
        {loading ? 'Purging...' : 'Purge by Vary'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function HashTab() {
  const { result, loading, submit } = useFormAction();
  const [hash, setHash] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Cache Entry Hash</label>
        <input className="input mt-1" placeholder="abc123..." value={hash} onChange={(e) => setHash(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={loading || !hash.trim()} onClick={() => submit('/api/purge/hash', { hash })}>
        {loading ? 'Purging...' : 'Purge by Hash'}
      </button>
      <ResultDisplay result={result} />
    </div>
  );
}

function PurgeAllTab() {
  const { result, loading, submit } = useFormAction();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">
          This will purge <strong>all</strong> cache entries. This action cannot be undone.
        </p>
      </div>
      <button className="btn-danger" disabled={loading} onClick={() => setConfirm(true)}>
        {loading ? 'Purging...' : 'Purge All'}
      </button>
      <ConfirmDialog
        open={confirm}
        title="Purge All Cache Entries"
        message="Are you sure you want to purge the entire cache? This action cannot be undone."
        confirmLabel="Purge Everything"
        variant="danger"
        onConfirm={() => { setConfirm(false); submit('/api/purge/all', {}); }}
        onCancel={() => setConfirm(false)}
      />
      <ResultDisplay result={result} />
    </div>
  );
}

export function PurgeForm() {
  return (
    <div className="card">
      <Tabs
        tabs={[
          { key: 'url', label: 'URL', content: <UrlTab /> },
          { key: 'bulk', label: 'Bulk URLs', content: <BulkUrlsTab /> },
          { key: 'tags', label: 'Tags', content: <TagsTab /> },
          { key: 'tag-pattern', label: 'Tag Pattern', content: <TagPatternTab /> },
          { key: 'url-pattern', label: 'URL Pattern', content: <UrlPatternTab /> },
          { key: 'host', label: 'Host', content: <HostTab /> },
          { key: 'vary', label: 'Vary', content: <VaryTab /> },
          { key: 'hash', label: 'Hash', content: <HashTab /> },
          { key: 'all', label: 'Purge All', content: <PurgeAllTab /> },
        ]}
      />
    </div>
  );
}
