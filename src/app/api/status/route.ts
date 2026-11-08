import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

// GET /api/status — Trident license / degraded-mode (1.5.0).
export async function GET() {
  try {
    const result = await trident.status();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
