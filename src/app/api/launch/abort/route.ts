import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await trident.launchAbort(body.reason);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
