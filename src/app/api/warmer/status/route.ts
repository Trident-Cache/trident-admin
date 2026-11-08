import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await trident.warmerStatus());
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
