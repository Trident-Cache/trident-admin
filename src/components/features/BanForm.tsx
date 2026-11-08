'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { apiUrl } from '@/lib/format';

export function BanForm() {
  const router = useRouter();
  const [pattern, setPattern] = useState('');
  const [type, setType] = useState<'url' | 'tag' | 'host'>('url');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/bans'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, type }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Ban created (ID: ${data.id})` });
        setPattern('');
        router.refresh();
      } else {
        setResult({ success: false, message: data.error || 'Failed to create ban' });
      }
    } catch (err) {
      setResult({ success: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900">Create Ban</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="label">Pattern</label>
          <input
            className="input mt-1"
            placeholder="/api/.*"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="select mt-1" value={type} onChange={(e) => setType(e.target.value as 'url' | 'tag' | 'host')}>
            <option value="url">URL</option>
            <option value="tag">Tag</option>
            <option value="host">Host</option>
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={loading || !pattern.trim()}>
          {loading ? 'Creating...' : 'Create Ban'}
        </button>
      </form>
      {result && (
        <div className="mt-4">
          {result.success ? (
            <SuccessAlert message={result.message} />
          ) : (
            <ErrorAlert message={result.message} />
          )}
        </div>
      )}
    </div>
  );
}
