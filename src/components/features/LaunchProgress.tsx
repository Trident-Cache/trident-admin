'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiUrl } from '@/lib/format';

interface LaunchStatus {
  launchId: string;
  status: 'warming' | 'ready' | 'completed' | 'aborted';
  urlsTotal: number;
  urlsWarmed: number;
  urlsFailed: number;
  startedAt: string;
  completedAt?: string;
}

interface LaunchProgressProps {
  launchId: string;
  initialStatus: LaunchStatus;
}

export function LaunchProgress({ launchId, initialStatus }: LaunchProgressProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LaunchStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'complete' | 'abort' | null>(null);

  useEffect(() => {
    if (status.status === 'completed' || status.status === 'aborted') return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/launch/status/${launchId}`));
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(id);
  }, [launchId, status.status]);

  const handleAction = async (action: 'complete' | 'abort') => {
    setLoading(true);
    setConfirmAction(null);
    try {
      await fetch(apiUrl(`/api/launch/${action}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const statusVariant = {
    warming: 'warning' as const,
    ready: 'success' as const,
    completed: 'info' as const,
    aborted: 'error' as const,
  };

  const isActive = status.status === 'warming' || status.status === 'ready';

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Launch: {launchId}</h3>
          <p className="text-xs text-gray-500">Started: {new Date(status.startedAt).toLocaleString()}</p>
        </div>
        <Badge variant={statusVariant[status.status]}>{status.status}</Badge>
      </div>

      <ProgressBar
        value={status.urlsWarmed}
        max={status.urlsTotal}
        label={`${status.urlsWarmed} / ${status.urlsTotal} URLs warmed`}
        showPercent
        color={status.urlsFailed > 0 ? 'yellow' : 'blue'}
      />

      {status.urlsFailed > 0 && (
        <p className="text-xs text-red-600">{status.urlsFailed} URLs failed</p>
      )}

      {isActive && (
        <div className="flex gap-2">
          <button
            className="btn-primary btn-sm"
            disabled={loading || status.status !== 'ready'}
            onClick={() => setConfirmAction('complete')}
          >
            Complete
          </button>
          <button
            className="btn-danger btn-sm"
            disabled={loading}
            onClick={() => setConfirmAction('abort')}
          >
            Abort
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === 'complete'}
        title="Complete Launch"
        message="This will finalize the launch and switch traffic. Are you sure?"
        confirmLabel="Complete"
        variant="primary"
        onConfirm={() => handleAction('complete')}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'abort'}
        title="Abort Launch"
        message="This will abort the launch. Warmed entries will remain but the launch will be cancelled."
        confirmLabel="Abort"
        variant="danger"
        onConfirm={() => handleAction('abort')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
