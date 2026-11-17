import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness of the panel process, for a container or load-balancer health
 * check. Reachable without a session, and it says nothing else: it does not
 * contact Trident and reports no version or configuration.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
