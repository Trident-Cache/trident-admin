import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

type Body =
  | { action: 'query-pin'; param: string; class: 'noise' | 'signal'; host?: string; pathPrefix?: string }
  | { action: 'query-unpin'; param: string; host?: string; pathPrefix?: string }
  | { action: 'query-reset' }
  | { action: 'query-delete'; host?: string; pathPrefix?: string }
  | { action: 'path-pin'; status: 'dead' | 'alive'; host?: string; pathPrefix?: string }
  | { action: 'path-unpin'; host?: string; pathPrefix?: string }
  | { action: 'path-delete'; host?: string; pathPrefix?: string }
  | { action: 'path-reset' }
  | { action: 'reset-all' }
  | { action: 'waf-export' };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    switch (body.action) {
      case 'query-pin':
        return NextResponse.json(await trident.denoiserQueryPin({
          param: body.param, class: body.class, host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'query-unpin':
        return NextResponse.json(await trident.denoiserQueryUnpin({
          param: body.param, host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'query-reset':
        return NextResponse.json(await trident.denoiserQueryReset());
      case 'query-delete':
        return NextResponse.json(await trident.denoiserQueryDeleteScope({
          host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'path-pin':
        return NextResponse.json(await trident.denoiserPathPin({
          status: body.status, host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'path-unpin':
        return NextResponse.json(await trident.denoiserPathUnpin({
          host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'path-delete':
        return NextResponse.json(await trident.denoiserPathDeleteZone({
          host: body.host, pathPrefix: body.pathPrefix,
        }));
      case 'path-reset':
        return NextResponse.json(await trident.denoiserPathReset());
      case 'reset-all':
        await trident.denoiserQueryReset();
        await trident.denoiserPathReset();
        return NextResponse.json({ ok: true });
      case 'waf-export':
        return NextResponse.json(await trident.denoiserWafExport());
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
