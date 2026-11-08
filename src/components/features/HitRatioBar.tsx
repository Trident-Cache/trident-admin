interface HitRatioBarProps {
  hits: number;
  misses: number;
}

export function HitRatioBar({ hits, misses }: HitRatioBarProps) {
  const total = hits + misses;
  const ratio = total > 0 ? (hits / total) * 100 : 0;

  const color = ratio >= 80 ? 'bg-green-500' : ratio >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">Hit Ratio</span>
        <span className="font-mono text-gray-600">{ratio.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${ratio}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{hits.toLocaleString()} hits</span>
        <span>{misses.toLocaleString()} misses</span>
      </div>
    </div>
  );
}
