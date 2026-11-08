import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export async function GET() {
  try {
    const result = await trident.health();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
