/**
 * Where to send the browser after a sign-in. The value arrives in the query
 * string, so anything that is not a plain path inside the panel becomes "/".
 * Pure, and safe to import from browser code.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || next.length > 2048) return '/';
  if (!next.startsWith('/')) return '/';
  // "//host" and "/\host" are read by browsers as another site.
  if (next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next.includes('\\')) return '/';
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return '/';
  }
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return '/';
  return next;
}
