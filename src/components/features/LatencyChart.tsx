import { formatMs } from '@/lib/format';

interface LatencyChartProps {
  p50: number;
  p90: number;
  p99: number;
  avg: number;
  max: number;
}

export function LatencyChart({ p50, p90, p99, avg, max }: LatencyChartProps) {
  const maxVal = Math.max(p50, p90, p99, avg, max, 1);

  const bars = [
    { label: 'p50', value: p50, color: 'bg-green-500' },
    { label: 'p90', value: p90, color: 'bg-trident-500' },
    { label: 'p99', value: p99, color: 'bg-yellow-500' },
    { label: 'avg', value: avg, color: 'bg-gray-500' },
    { label: 'max', value: max, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="w-8 text-right text-xs font-medium text-gray-500">{bar.label}</span>
          <div className="flex-1">
            <div className="h-4 overflow-hidden rounded-sm bg-gray-100">
              <div
                className={`h-full rounded-sm ${bar.color}`}
                style={{ width: `${(bar.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-16 text-right font-mono text-xs text-gray-600">{formatMs(bar.value)}</span>
        </div>
      ))}
    </div>
  );
}
