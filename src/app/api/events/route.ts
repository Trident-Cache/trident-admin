import { NextRequest } from 'next/server';
import http from 'node:http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHANNEL_MAP: Record<string, string> = {
  cache: '/admin/events/cache',
  backends: '/admin/events/backends',
  errors: '/admin/events/errors',
};
const DEFAULT_PATH = '/admin/events/requests';

export async function GET(request: NextRequest) {
  const adminUrl = process.env.TRIDENT_ADMIN_URL || 'http://localhost:9303';
  const authToken = process.env.TRIDENT_AUTH_TOKEN;
  const channel = request.nextUrl.searchParams.get('channel') || '';

  const path = CHANNEL_MAP[channel] || DEFAULT_PATH;
  const parsed = new URL(adminUrl);

  const stream = new ReadableStream({
    start(controller) {
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path,
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            controller.enqueue(new TextEncoder().encode(`event: error\ndata: upstream ${res.statusCode}\n\n`));
            controller.close();
            return;
          }

          res.on('data', (chunk: Buffer) => {
            try {
              controller.enqueue(chunk);
            } catch {
              res.destroy();
            }
          });

          res.on('end', () => {
            try { controller.close(); } catch {}
          });

          res.on('error', () => {
            try { controller.close(); } catch {}
          });
        },
      );

      req.on('error', () => {
        try {
          controller.enqueue(new TextEncoder().encode(`event: error\ndata: connection failed\n\n`));
          controller.close();
        } catch {}
      });

      request.signal.addEventListener('abort', () => {
        req.destroy();
      });

      req.end();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
