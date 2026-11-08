interface SuccessAlertProps {
  title?: string;
  message: string;
}

export function SuccessAlert({ title = 'Success', message }: SuccessAlertProps) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex gap-3">
        <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-green-800">{title}</h3>
          <p className="mt-1 text-sm text-green-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
