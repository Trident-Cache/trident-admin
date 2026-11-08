import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';
export async function POST(request: Request) {
  try { const body = await request.json().catch(() => ({})); return NextResponse.json(await trident.reflectDisable(body?.mode === 'hard' ? 'hard' : 'replay')); }
  catch (err) {
    if (err instanceof TridentError) return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
