'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { SuccessAlert } from '@/components/ui/SuccessAlert';
import { apiUrl } from '@/lib/format';

export function ConfigActions() {
  const router = useRouter();
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [snapshotPath, setSnapshotPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleReload = async () => {
    setReloadConfirm(false);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/config/reload'), { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message || 'Configuration reloaded' });
        router.refresh();
      } else {
        setResult({ success: false, message: data.error || 'Failed to reload' });
      }
    } catch (err) {
      setResult({ success: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleSnapshot = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/snapshot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: snapshotPath || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `Snapshot saved: ${data.path} (${data.entriesCount} entries)` });
      } else {
        setResult({ success: false, message: data.error || 'Failed to create snapshot' });
      }
    } catch (err) {
      setResult({ success: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Actions</h3>

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={loading} onClick={() => setReloadConfirm(true)}>
          Reload Config
        </button>

        <div className="flex gap-2">
          <input
            className="input w-64"
            placeholder="Snapshot path (optional)"
            value={snapshotPath}
            onChange={(e) => setSnapshotPath(e.target.value)}
          />
          <button className="btn-secondary" disabled={loading} onClick={handleSnapshot}>
            Snapshot
          </button>
        </div>
      </div>

      {result && (
        result.success
          ? <SuccessAlert message={result.message} />
          : <ErrorAlert message={result.message} />
      )}

      <ConfirmDialog
        open={reloadConfirm}
        title="Reload Configuration"
        message="This will hot-reload the Trident configuration from disk."
        confirmLabel="Reload"
        variant="primary"
        onConfirm={handleReload}
        onCancel={() => setReloadConfirm(false)}
      />
    </div>
  );
}
