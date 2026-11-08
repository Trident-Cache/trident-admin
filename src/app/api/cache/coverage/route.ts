import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: 'Provide at least one URL' }, { status: 400 });
    }
    return NextResponse.json(
      await trident.cacheCoverage(urls, {
        host: body?.host || undefined,
        scheme: body?.scheme || undefined,
        method: body?.method || undefined,
      }),
    );
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
