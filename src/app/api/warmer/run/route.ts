import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { sitemaps?: unknown };
    const sitemaps = Array.isArray(body.sitemaps) ? body.sitemaps.filter((s): s is string => typeof s === 'string') : [];
    return NextResponse.json(await trident.warmerRun({ sitemaps }));
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
