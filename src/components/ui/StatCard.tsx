interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
}

const colorMap = {
  blue: 'bg-trident-50 border-trident-200 text-trident-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
};

const iconColorMap = {
  blue: 'text-trident-500',
  green: 'text-green-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  gray: 'text-gray-400',
};

export function StatCard({ label, value, subValue, icon, color = 'gray' }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subValue && <p className="mt-1 text-xs text-gray-400">{subValue}</p>}
        </div>
        {icon && <div className={iconColorMap[color]}>{icon}</div>}
      </div>
    </div>
  );
}
