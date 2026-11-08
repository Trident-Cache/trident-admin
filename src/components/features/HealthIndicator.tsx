'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/format';

export function HealthIndicator() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
        setHealthy(res.ok);
      } catch {
        setHealthy(false);
      }
    };

    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500" title={healthy === null ? 'Checking...' : healthy ? 'Trident is healthy' : 'Trident is unreachable'}>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          healthy === null
            ? 'bg-gray-400'
            : healthy
            ? 'bg-green-500'
            : 'bg-red-500'
        }`}
      />
      <span className="hidden sm:inline">
        {healthy === null ? 'Checking' : healthy ? 'Healthy' : 'Offline'}
      </span>
    </div>
  );
}
