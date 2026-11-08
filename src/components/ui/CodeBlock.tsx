interface CodeBlockProps {
  children: string;
  className?: string;
}

export function CodeBlock({ children, className = '' }: CodeBlockProps) {
  return (
    <pre className={`overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100 ${className}`}>
      <code>{children}</code>
    </pre>
  );
}
