interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  size?: 'sm' | 'md';
}

const colorMap = {
  blue: 'bg-trident-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = false,
  color = 'blue',
  size = 'md',
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div>
      {(label || showPercent) && (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          {label && <span>{label}</span>}
          {showPercent && <span>{percent.toFixed(1)}%</span>}
        </div>
      )}
      <div className={`overflow-hidden rounded-full bg-gray-200 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`h-full rounded-full transition-all ${colorMap[color]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
