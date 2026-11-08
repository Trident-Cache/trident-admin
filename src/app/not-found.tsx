import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Page Not Found</h2>
        <p className="mt-2 text-sm text-gray-600">The page you are looking for does not exist.</p>
        <Link href="/" className="btn-primary mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
