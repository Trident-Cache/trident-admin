'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiUrl } from '@/lib/format';

interface BackendCardProps {
  name: string;
  url: string;
  healthy: boolean;
  drained: boolean;
  weight: number;
  totalRequests?: number;
  failedRequests?: number;
  avgResponseTimeMs?: number;
  activeConnections?: number;
  circuitState?: 'closed' | 'open' | 'half-open';
}

export function BackendCard({
  name,
  url,
  healthy,
  drained,
  weight,
  totalRequests,
  failedRequests,
  avgResponseTimeMs,
  activeConnections,
  circuitState,
}: BackendCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const successRate = totalRequests && totalRequests > 0
    ? (((totalRequests - (failedRequests || 0)) / totalRequests) * 100).toFixed(1)
    : null;

  const handleToggle = async () => {
    setLoading(true);
    setConfirm(false);
    try {
      const action = drained ? 'restore' : 'drain';
      await fetch(apiUrl(`/api/backends/${action}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{url}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={healthy ? 'success' : 'error'}>
              {healthy ? 'Healthy' : 'Unhealthy'}
            </Badge>
            {drained && <Badge variant="warning">Drained</Badge>}
            {circuitState && circuitState !== 'closed' && (
              <Badge variant={circuitState === 'open' ? 'error' : 'warning'}>
                Circuit: {circuitState}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500">Weight</span>
            <p className="font-medium text-gray-700">{weight}</p>
          </div>
          {totalRequests !== undefined && (
            <div>
              <span className="text-gray-500">Requests</span>
              <p className="font-medium text-gray-700">{totalRequests.toLocaleString()}</p>
            </div>
          )}
          {avgResponseTimeMs !== undefined && (
            <div>
              <span className="text-gray-500">Avg Response</span>
              <p className="font-medium text-gray-700">{avgResponseTimeMs.toFixed(1)}ms</p>
            </div>
          )}
          {successRate !== null && (
            <div>
              <span className="text-gray-500">Success Rate</span>
              <p className="font-medium text-gray-700">{successRate}%</p>
            </div>
          )}
          {activeConnections !== undefined && (
            <div>
              <span className="text-gray-500">Active Conns</span>
              <p className="font-medium text-gray-700">{activeConnections}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            className={drained ? 'btn-primary btn-sm w-full' : 'btn-danger btn-sm w-full'}
            disabled={loading}
            onClick={() => drained ? handleToggle() : setConfirm(true)}
          >
            {loading ? 'Processing...' : drained ? 'Restore' : 'Drain'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Drain backend "${name}"?`}
        message="This will stop sending new requests to this backend. Existing connections will finish."
        confirmLabel="Drain"
        variant="danger"
        onConfirm={handleToggle}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
