import { NextRequest } from 'next/server';
import http from 'node:http';
import { EventHub, type OpenUpstream } from '@/lib/panel/event-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHANNEL_MAP: Record<string, string> = {
  cache: '/admin/events/cache',
  backends: '/admin/events/backends',
  errors: '/admin/events/errors',
};
const DEFAULT_PATH = '/admin/events/requests';

// A tab that stops reading is dropped once this many events wait for it; its
// EventSource reconnects by itself.
const MAX_QUEUED_EVENTS = 2000;

/** Open one event stream on Trident's admin API. `path` is one of the four paths above. */
const openUpstream: OpenUpstream = (path, handlers) => {
  const adminUrl = process.env.TRIDENT_ADMIN_URL || 'http://localhost:9303';
  const authToken = process.env.TRIDENT_AUTH_TOKEN;
  const parsed = new URL(adminUrl);

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
        handlers.onClose({ status: res.statusCode });
        res.destroy();
        return;
      }
      res.on('data', (chunk: Buffer) => handlers.onData(chunk));
      res.on('end', () => handlers.onClose({}));
      res.on('error', () => handlers.onClose({}));
    },
  );
  req.on('error', () => handlers.onClose({ failed: true }));
  req.end();

  return { close: () => req.destroy() };
};

// One hub for the process, so every tab shares the same upstream streams. On
// `globalThis` because a module can be evaluated more than once in development.
const HUB = Symbol.for('trident.panel.event-hub');
type GlobalWithHub = typeof globalThis & { [HUB]?: EventHub };

function eventHub(): EventHub {
  const scope = globalThis as GlobalWithHub;
  if (!scope[HUB]) scope[HUB] = new EventHub(openUpstream);
  return scope[HUB];
}

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel') || '';
  const path = CHANNEL_MAP[channel] || DEFAULT_PATH;

  let unsubscribe: () => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const finish = () => {
        if (!open) return;
        open = false;
        try { controller.close(); } catch {}
      };

      unsubscribe = eventHub().subscribe(path, {
        send(event) {
          if (!open) return false;
          // desiredSize falls by one for every event the tab has not read yet.
          if ((controller.desiredSize ?? 0) < -MAX_QUEUED_EVENTS) return false;
          try {
            controller.enqueue(event);
            return true;
          } catch {
            return false;
          }
        },
        close: finish,
      });

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        finish();
      });
    },
    cancel() {
      unsubscribe();
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
