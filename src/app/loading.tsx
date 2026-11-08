export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded-sm bg-gray-200" />
            <div className="mt-2 h-7 w-16 animate-pulse rounded-sm bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-gray-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-1/3 animate-pulse rounded-sm bg-gray-200" />
              <div className="h-4 w-1/4 animate-pulse rounded-sm bg-gray-200" />
              <div className="h-4 w-1/6 animate-pulse rounded-sm bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
