'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatBytes, apiUrl } from '@/lib/format';

interface CacheEntryRowProps {
  url: string;
  host: string;
  method: string;
  size: number;
  ttl: number;
  tags: string[];
  vary?: Array<[string, string]>;
  createdAt: string;
  storageKey: string;
}

function decodeBase64ToText(b64: string): string {
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '<unable to decode body>';
  }
}

export function CacheEntryRow({
  url,
  host,
  method,
  size,
  ttl,
  tags,
  vary,
  createdAt,
  storageKey,
}: CacheEntryRowProps) {
  const router = useRouter();
  const [purging, setPurging] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodyText, setBodyText] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [bodyMeta, setBodyMeta] = useState<{ contentType?: string; statusCode?: number } | null>(null);

  const handlePurge = async () => {
    setPurging(true);
    try {
      await fetch(apiUrl('/api/purge/hash'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: storageKey }),
      });
      router.refresh();
    } finally {
      setPurging(false);
    }
  };

  const handleViewBody = async () => {
    setBodyOpen(true);
    if (bodyText !== null || bodyLoading) return;
    setBodyLoading(true);
    setBodyError(null);
    try {
      // Strip protocol from `url`, since the entry endpoint takes the path only.
      // Forward the original scheme so trident can match http vs https cached variants.
      let path = url;
      let scheme = 'https';
      try {
        const u = new URL(url);
        path = u.pathname + u.search;
        scheme = u.protocol.replace(':', '') || 'https';
      } catch {
        // already a path — leave scheme as default
      }
      const params = new URLSearchParams({
        url: path,
        method,
        scheme,
        include_body: 'true',
      });
      if (host) params.set('host', host);
      const res = await fetch(apiUrl(`/api/cache/entry?${params}`));
      const data = await res.json();
      if (!res.ok) {
        setBodyError(data.error || `HTTP ${res.status}`);
        return;
      }
      setBodyMeta({ contentType: data.contentType, statusCode: data.statusCode });
      if (typeof data.body === 'string') {
        setBodyText(decodeBase64ToText(data.body));
      } else {
        setBodyError('Backend did not return a body (entry may be > 10 MB or already evicted).');
      }
    } catch (err) {
      setBodyError(String(err));
    } finally {
      setBodyLoading(false);
    }
  };

  const isExpired = ttl <= 0;
  const visibleTags = tagsExpanded ? tags : tags.slice(0, 3);
  const hasHidden = tags.length > 3;

  return (
    <>
      <tr>
        <td className="max-w-xs truncate" title={url}>{url}</td>
        <td>{host}</td>
        <td><Badge variant="neutral">{method}</Badge></td>
        <td>{formatBytes(size)}</td>
        <td>
          <Badge variant={isExpired ? 'error' : 'success'}>
            {isExpired ? 'Expired' : `${ttl}s`}
          </Badge>
        </td>
        <td className="max-w-[260px]">
          <div className="flex flex-wrap items-center gap-1">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="info">{tag}</Badge>
            ))}
            {hasHidden && !tagsExpanded && (
              <button
                type="button"
                onClick={() => setTagsExpanded(true)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                title="Show all tags"
              >
                +{tags.length - 3}
              </button>
            )}
            {hasHidden && tagsExpanded && (
              <button
                type="button"
                onClick={() => setTagsExpanded(false)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                title="Collapse"
              >
                show less
              </button>
            )}
          </div>
          {vary && vary.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {vary.map(([h, v], i) => (
                <span
                  key={`${h}=${v}-${i}`}
                  className="inline-flex items-center rounded-sm bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700"
                  title="Vary dimension"
                >
                  {h}={v}
                </span>
              ))}
            </div>
          )}
        </td>
        <td className="text-xs text-gray-500">{new Date(createdAt).toLocaleString()}</td>
        <td>
          <div className="flex gap-1">
            <button
              className="btn-secondary btn-sm"
              onClick={handleViewBody}
              title="View cached body"
            >
              Body
            </button>
            <button
              className="btn-danger btn-sm"
              disabled={purging}
              onClick={handlePurge}
            >
              {purging ? '...' : 'Purge'}
            </button>
          </div>
        </td>
      </tr>
      {bodyOpen && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Body</span>
                {bodyMeta?.statusCode != null && <> · {bodyMeta.statusCode}</>}
                {bodyMeta?.contentType && <> · {bodyMeta.contentType}</>}
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setBodyOpen(false)}
              >
                close
              </button>
            </div>
            {bodyLoading && <div className="mt-2 text-xs text-gray-500">Loading…</div>}
            {bodyError && <div className="mt-2 text-xs text-red-600">{bodyError}</div>}
            {bodyText !== null && !bodyLoading && (
              <pre className="mt-2 max-h-[400px] overflow-auto whitespace-pre-wrap break-all rounded-sm border border-gray-200 bg-white p-2 font-mono text-xs text-gray-800">
                {bodyText.slice(0, 200_000)}
                {bodyText.length > 200_000 && '\n\n… [truncated, body exceeds 200 KB preview]'}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
