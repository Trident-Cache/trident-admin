import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [config, rules] = await Promise.all([
      trident.config(),
      trident.rules().catch(() => null),
    ]);
    return NextResponse.json({ config, rules });
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
