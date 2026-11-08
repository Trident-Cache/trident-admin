'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { apiUrl, formatBytes, formatMs } from '@/lib/format';

interface TridentEvent {
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const MAX_EVENTS = 200;

const typeColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  request: 'info',
  cache: 'success',
  backend: 'warning',
  error: 'error',
  connected: 'neutral',
  lag: 'warning',
};

const cacheStatusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  HIT: 'success',
  MISS: 'warning',
  PASS: 'neutral',
  STALE: 'warning',
  ERROR: 'error',
  SYNTH: 'info',
};

// SSE event names that Trident sends
// Note: 'error' is handled separately because EventSource fires 'error' for connection issues too
const EVENT_NAMES = ['request', 'cache', 'backend', 'connected', 'lag'];

// Headers worth highlighting in the detail view
const IMPORTANT_REQ_HEADERS = [
  'user-agent', 'x-forwarded-for', 'cf-connecting-ip', 'cf-ipcountry',
  'accept', 'accept-encoding', 'accept-language', 'cache-control',
  'x-forwarded-proto', 'x-real-ip', 'host', 'referer',
];

const IMPORTANT_RESP_HEADERS = [
  'cache-control', 'x-cache', 'x-magento-tags', 'x-cache-hits', 'x-cache-ttl',
  'content-type', 'content-length', 'set-cookie', 'x-built-with', 'x-dist',
  'x-response-time', 'x-request-id', 'via', 'expires', 'age',
];

interface EventStreamProps {
  channel?: string;
}

export function EventStream({ channel }: EventStreamProps) {
  const [events, setEvents] = useState<TridentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (pausedRef.current) return;
    const evt: TridentEvent = {
      eventType,
      timestamp: new Date().toISOString(),
      data,
    };
    setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
    setExpandedIndex((prev) => (prev != null ? prev + 1 : null));
  }, []);

  useEffect(() => {
    const url = channel ? apiUrl(`/api/events?channel=${channel}`) : apiUrl('/api/events');
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    for (const name of EVENT_NAMES) {
      es.addEventListener(name, (msg) => {
        if (name === 'connected') {
          setConnected(true);
          return;
        }
        try {
          const parsed = JSON.parse(msg.data);
          // Skip empty error events (e.g. from connection timeouts)
          if (name === 'error' && Object.keys(parsed).length === 0) return;
          addEvent(name, parsed);
        } catch {
          addEvent(name, { raw: msg.data });
        }
      });
    }

    // Handle Trident 'event: error' SSE events (separate from connection errors)
    es.addEventListener('error', ((msg: MessageEvent) => {
      if (!msg.data) return; // connection error, not an SSE event
      try {
        const parsed = JSON.parse(msg.data);
        if (Object.keys(parsed).length === 0) return;
        addEvent('error', parsed);
      } catch {
        addEvent('error', { raw: msg.data });
      }
    }) as EventListener);

    // Also handle unnamed events (fallback)
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        addEvent(parsed.type || 'event', parsed);
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [channel, addEvent]);

  useEffect(() => {
    if (scrollRef.current && expandedIndex == null) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, expandedIndex]);

  const toggleExpand = (i: number) => {
    setExpandedIndex((prev) => (prev === i ? null : i));
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-600">
            {connected ? 'Connected' : 'Disconnected'} - {events.length} events
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => { setEvents([]); setExpandedIndex(null); }}>
            Clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 max-h-[700px] space-y-0.5 overflow-y-auto">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Waiting for events...</p>
        ) : (
          events.map((event, i) => (
            <div key={i}>
              <div
                className={`flex cursor-pointer items-start gap-3 rounded px-2 py-1.5 text-xs transition-colors ${
                  expandedIndex === i ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleExpand(i)}
              >
                <span className="w-20 shrink-0 font-mono text-gray-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <Badge variant={typeColors[event.eventType] || 'neutral'}>{event.eventType}</Badge>
                {event.eventType === 'request' && event.data.cache_status ? (
                  <Badge variant={cacheStatusColors[String(event.data.cache_status)] || 'neutral'}>
                    {String(event.data.cache_status)}
                  </Badge>
                ) : null}
                <span className="flex-1 truncate font-mono text-gray-600">
                  {formatEventSummary(event)}
                </span>
                <span className="shrink-0 text-gray-400">
                  {expandedIndex === i ? '▼' : '▶'}
                </span>
              </div>

              {expandedIndex === i && (
                <EventDetail event={event} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EventDetail({ event }: { event: TridentEvent }) {
  const d = event.data;

  if (event.eventType === 'request') {
    return <RequestDetail data={d} />;
  }

  if (event.eventType === 'cache') {
    return <CacheDetail data={d} />;
  }

  if (event.eventType === 'backend') {
    return <BackendDetail data={d} />;
  }

  // Generic fallback
  return (
    <div className="ml-[92px] rounded-b bg-gray-50 px-3 py-2 text-xs">
      <pre className="whitespace-pre-wrap font-mono text-gray-600">
        {JSON.stringify(d, null, 2)}
      </pre>
    </div>
  );
}

function RequestDetail({ data }: { data: Record<string, unknown> }) {
  const reqHeaders = (data.request_headers || {}) as Record<string, string>;
  const respHeaders = (data.response_headers || {}) as Record<string, string>;
  const tags = respHeaders['x-magento-tags'];

  return (
    <div className="ml-[92px] space-y-3 rounded-b bg-gray-50 px-3 py-3 text-xs">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <KV label="Request ID" value={str(data.request_id)} mono />
        <KV label="Status" value={str(data.status)} />
        <KV label="Cache" value={str(data.cache_status)} />
        <KV label="Duration" value={data.duration_ms != null ? formatMs(Number(data.duration_ms)) : '-'} />
        <KV label="Host" value={str(data.host)} />
        <KV label="Client IP" value={str(data.client_ip)} />
        <KV label="Bytes" value={data.bytes_sent != null ? formatBytes(Number(data.bytes_sent)) : '-'} />
        <KV label="Backend Duration" value={data.backend_duration_ms != null ? formatMs(Number(data.backend_duration_ms)) : '-'} />
      </div>

      {/* Cache Tags */}
      {tags && (
        <div>
          <span className="font-semibold text-gray-700">Cache Tags</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.split(',').map((tag) => (
              <span key={tag} className="rounded-sm bg-trident-100 px-1.5 py-0.5 font-mono text-trident-700">
                {tag.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Request Headers */}
      <HeaderTable title="Request Headers" headers={reqHeaders} important={IMPORTANT_REQ_HEADERS} />

      {/* Response Headers */}
      <HeaderTable title="Response Headers" headers={respHeaders} important={IMPORTANT_RESP_HEADERS} />
    </div>
  );
}

function CacheDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="ml-[92px] space-y-2 rounded-b bg-gray-50 px-3 py-3 text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <KV label="Event" value={str(data.event_type)} />
        <KV label="Path" value={str(data.path)} mono />
        <KV label="Cache Key" value={str(data.cache_key)} mono />
        <KV label="Size" value={data.size != null ? formatBytes(Number(data.size)) : '-'} />
        <KV label="Age" value={data.age_secs != null ? `${data.age_secs}s` : '-'} />
        <KV label="Reason" value={str(data.reason)} />
      </div>
    </div>
  );
}

function BackendDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="ml-[92px] space-y-2 rounded-b bg-gray-50 px-3 py-3 text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <KV label="Backend" value={str(data.name)} />
        <KV label="Event" value={str(data.event_type)} />
        <KV label="Healthy" value={data.healthy != null ? (data.healthy ? 'Yes' : 'No') : '-'} />
        <KV label="Response Time" value={data.response_time_ms != null ? formatMs(Number(data.response_time_ms)) : '-'} />
        <KV label="Reason" value={str(data.reason)} />
        <KV label="Error Count" value={data.error_count != null ? String(data.error_count) : '-'} />
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value || value === '-') return (
    <div>
      <span className="text-gray-500">{label}</span>
      <p className="text-gray-400">-</p>
    </div>
  );
  return (
    <div className="min-w-0">
      <span className="text-gray-500">{label}</span>
      <p className={`truncate font-medium text-gray-900 ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}

function HeaderTable({
  title,
  headers,
  important,
}: {
  title: string;
  headers: Record<string, string>;
  important: string[];
}) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return null;

  // Sort: important headers first, then alphabetical
  const importantSet = new Set(important);
  const sorted = entries.sort(([a], [b]) => {
    const aImp = importantSet.has(a);
    const bImp = importantSet.has(b);
    if (aImp && !bImp) return -1;
    if (!aImp && bImp) return 1;
    return a.localeCompare(b);
  });

  // Skip very long CSP headers in collapsed view
  const LONG_HEADERS = ['content-security-policy', 'content-security-policy-report-only'];

  return (
    <details className="group">
      <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
        {title} ({entries.length})
      </summary>
      <div className="mt-1 max-h-60 overflow-y-auto">
        <table className="w-full">
          <tbody>
            {sorted.map(([key, val]) => {
              const isLong = LONG_HEADERS.includes(key);
              const display = isLong ? `${String(val).slice(0, 80)}...` : String(val);
              return (
                <tr key={key} className="border-b border-gray-100">
                  <td className="whitespace-nowrap py-0.5 pr-3 font-mono font-medium text-gray-700">{key}</td>
                  <td className="break-all py-0.5 font-mono text-gray-600" title={String(val)}>
                    {display}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function str(v: unknown): string {
  if (v == null || v === '') return '-';
  return String(v);
}

function formatEventSummary(event: TridentEvent): string {
  const d = event.data;

  if (event.eventType === 'request') {
    const status = d.status || '';
    const dur = d.duration_ms;
    const size = d.bytes_sent;
    const parts = [`${d.method} ${d.path}`, String(status)];
    if (dur != null) parts.push(formatMs(Number(dur)));
    if (size != null) parts.push(formatBytes(Number(size)));
    return parts.join(' ');
  }

  if (event.eventType === 'cache') {
    const type = d.event_type || '';
    return `${type} ${d.path || d.cache_key || ''}`;
  }

  if (event.eventType === 'backend') {
    return `${d.name || ''} ${d.event_type || ''} ${d.healthy != null ? (d.healthy ? 'healthy' : 'unhealthy') : ''}`;
  }

  if (d.raw) return String(d.raw);
  const json = JSON.stringify(d);
  return json === '{}' ? '(empty)' : json;
}
