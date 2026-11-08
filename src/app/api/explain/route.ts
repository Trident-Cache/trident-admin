import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';
import type { ExplainRequest } from '@trident-cache/sdk';

// POST /api/explain — dry-run cacheability (1.5.0). Body: { method, url, headers?, detail? }.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExplainRequest;
    if (!body?.url || !body?.method) {
      return NextResponse.json({ error: 'method and url are required' }, { status: 400 });
    }
    const result = await trident.explain({
      method: body.method,
      url: body.url,
      headers: body.headers,
      detail: body.detail,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
