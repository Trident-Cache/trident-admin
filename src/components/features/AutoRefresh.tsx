'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const intervals = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

const STORAGE_KEY = 'trident-auto-refresh';

export function AutoRefresh() {
  const router = useRouter();
  const [interval, setInterval_] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setInterval_(Number(saved));
  }, []);

  useEffect(() => {
    if (interval === 0) return;
    const id = setInterval(() => router.refresh(), interval);
    return () => clearInterval(id);
  }, [interval, router]);

  const handleChange = (val: number) => {
    setInterval_(val);
    localStorage.setItem(STORAGE_KEY, String(val));
  };

  return (
    <select
      className="select btn-sm w-auto"
      value={interval}
      onChange={(e) => handleChange(Number(e.target.value))}
      title="Auto-refresh interval"
    >
      {intervals.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.value === 0 ? 'Auto: Off' : `Auto: ${opt.label}`}
        </option>
      ))}
    </select>
  );
}
