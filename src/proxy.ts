/**
 * Runs before every page and every route of the panel (Next.js calls this
 * file convention "proxy"; it was "middleware" before Next 16).
 *
 * All of the panel's access rules are applied here and nowhere else: the
 * optional login, the refusal of cross-site state-changing requests, and the
 * three /api/auth/* endpoints. See `src/lib/panel/gate.ts` for the rules.
 *
 * There is deliberately no `matcher`: a path that is not matched is a path
 * that is not protected.
 */
import { NextResponse, type NextRequest } from 'next/server';
import type { GateRequest } from '@/lib/panel/gate';
import { getPanelGate } from '@/lib/panel/runtime';

async function readBodyUpTo(request: NextRequest, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function proxy(request: NextRequest) {
  const gateRequest: GateRequest = {
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    basePath: request.nextUrl.basePath,
    protocol: request.nextUrl.protocol,
    header: (name) => request.headers.get(name),
    cookie: (name) => request.cookies.get(name)?.value,
    readBody: (limit) => readBodyUpTo(request, limit),
  };

  const result = await getPanelGate().handle(gateRequest);
  if (result.kind === 'continue') return NextResponse.next();
  // Next.js expects an absolute Location from a proxy; it turns one on the
  // request's own host back into a relative path before sending it.
  const headers = result.headers.map(([name, value]): [string, string] =>
    name.toLowerCase() === 'location' ? [name, new URL(value, request.url).toString()] : [name, value],
  );
  return new NextResponse(result.body === '' ? null : result.body, {
    status: result.status,
    headers,
  });
}
