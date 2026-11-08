'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatBytes, formatMs } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
interface LiveEvent {
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const MAX_EVENTS = 200;

// Segmented control -> proxy channel param (matches /api/events route map).
const STREAMS: { key: string; label: string }[] = [
  { key: '', label: 'Requests' },
  { key: 'cache', label: 'Cache' },
  { key: 'backends', label: 'Backends' },
  { key: 'errors', label: 'Errors' },
];

// SSE event names Trident emits over a stream connection.
const EVENT_NAMES = ['request', 'cache', 'backend', 'connected', 'lag'];

type Conn = 'connecting' | 'open' | 'closed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function str(v: unknown): string {
  if (v == null || v === '') return '';
  return String(v);
}

// Map an HTTP status to the .stream-status sN class (s2..s5).
function statusClass(status: unknown): string | null {
  const n = Number(status);
  if (!Number.isFinite(n) || n < 100) return null;
  const bucket = Math.floor(n / 100);
  if (bucket >= 2 && bucket <= 5) return `s${bucket}`;
  return null;
}

const CACHE_CLASSES = new Set(['HIT', 'MISS', 'PASS', 'STALE']);
function cacheClass(verdict: unknown): string | null {
  const v = str(verdict).toUpperCase();
  return CACHE_CLASSES.has(v) ? `cache-${v}` : null;
}

function methodClass(method: unknown): string {
  const m = str(method).toUpperCase();
  return m ? `m-${m}` : '';
}

function clockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function summary(evt: LiveEvent): string {
  const d = evt.data;
  if (evt.eventType === 'request') {
    const parts = [str(d.path) || str(d.host) || ''];
    if (d.duration_ms != null) parts.push(formatMs(Number(d.duration_ms)));
    if (d.bytes_sent != null) parts.push(formatBytes(Number(d.bytes_sent)));
    return parts.filter(Boolean).join('  ');
  }
  if (evt.eventType === 'cache') {
    return [str(d.event_type), str(d.path) || str(d.cache_key)].filter(Boolean).join('  ');
  }
  if (evt.eventType === 'backend') {
    const health = d.healthy != null ? (d.healthy ? 'healthy' : 'unhealthy') : '';
    return [str(d.name), str(d.event_type), health].filter(Boolean).join('  ');
  }
  if (d.raw) return str(d.raw);
  const json = JSON.stringify(d);
  return json === '{}' ? '(no payload)' : json;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function EventsPage() {
  const [stream, setStream] = useState('');
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [conn, setConn] = useState<Conn>('connecting');
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const seqRef = useRef(0);

  const add = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (pausedRef.current) return;
    const evt: LiveEvent = { eventType, timestamp: new Date().toISOString(), data };
    setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
  }, []);

  // (Re)subscribe whenever the selected stream changes.
  useEffect(() => {
    const url = stream ? apiUrl(`/api/events?channel=${stream}`) : apiUrl('/api/events');
    const es = new EventSource(url);
    setConn('connecting');

    es.onopen = () => setConn('open');
    es.onerror = () => setConn('closed');

    for (const name of EVENT_NAMES) {
      es.addEventListener(name, (msg) => {
        if (name === 'connected') {
          setConn('open');
          return;
        }
        try {
          add(name, JSON.parse((msg as MessageEvent).data));
        } catch {
          add(name, { raw: (msg as MessageEvent).data });
        }
      });
    }

    // Trident 'event: error' frames (distinct from EventSource connection errors,
    // which carry no .data).
    es.addEventListener('error', ((msg: MessageEvent) => {
      if (!msg.data) return;
      try {
        const parsed = JSON.parse(msg.data);
        if (Object.keys(parsed).length === 0) return;
        add('error', parsed);
      } catch {
        add('error', { raw: msg.data });
      }
    }) as EventListener);

    // Unnamed fallback frames.
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        add(typeof parsed.type === 'string' ? parsed.type : 'event', parsed);
      } catch {
        /* ignore */
      }
    };

    return () => es.close();
  }, [stream, add]);

  const connMeta = useMemo(() => {
    if (conn === 'open') return { cls: 's2', label: 'Connected', dot: 'var(--success)' };
    if (conn === 'connecting') return { cls: 's4', label: 'Connecting…', dot: 'var(--warning)' };
    return { cls: 's5', label: 'Disconnected', dot: 'var(--danger)' };
  }, [conn]);

  // Live counters from the current buffer.
  const counts = useMemo(() => {
    let hit = 0, miss = 0, errors = 0;
    for (const e of events) {
      if (e.eventType === 'error') errors++;
      const cs = cacheClass(e.data.cache_status);
      if (cs === 'cache-HIT') hit++;
      else if (cs === 'cache-MISS') miss++;
      const st = Number(e.data.status);
      if (Number.isFinite(st) && st >= 500) errors++;
    }
    return { hit, miss, errors };
  }, [events]);

  const onClear = () => {
    setEvents([]);
    setExpanded(null);
  };

  return (
    <>
      <PageHead
        title="Live Events"
        sub="Real-time Server-Sent Events from Trident — requests, cache verdicts, backend health and errors."
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPaused((p) => !p)}>
              <Icon name={paused ? 'play' : 'pause'} size={14} /> {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn btn-ghost" onClick={onClear} disabled={events.length === 0}>
              <Icon name="trash" size={14} /> Clear
            </button>
          </>
        }
      />

      {conn === 'closed' && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} />
          <span>
            Disconnected from the event stream. Check that the Trident admin API is reachable; the
            console reconnects automatically when it comes back.
          </span>
        </div>
      )}

      {/* Counters from the live buffer */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard
          label="Connection"
          value={
            <span className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: connMeta.dot, display: 'inline-block' }} />
              <span style={{ fontSize: 15 }}>{connMeta.label}</span>
            </span>
          }
          hint={paused ? 'paused' : 'live'}
        />
        <StatCard label="Buffered" value={events.length} hint={`last ${MAX_EVENTS}`} />
        <StatCard label="Cache HIT / MISS" value={`${counts.hit} / ${counts.miss}`} hint="in buffer" />
        <StatCard label="Errors / 5xx" value={counts.errors} hint="in buffer" />
      </div>

      <Card
        title={<><Icon name="events" size={14} /> Event console</>}
        sub="Click a row to inspect the full payload. Newest first."
        actions={
          <div className="seg">
            {STREAMS.map((s) => (
              <button key={s.key} className={stream === s.key ? 'active' : ''} onClick={() => setStream(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        }
        padded={false}
      >
        <div className="row" style={{ justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <span className={`stream-status ${connMeta.cls}`}>{connMeta.label}</span>
        </div>

        <div className="stream">
          {events.length === 0 ? (
            <p className="text-muted" style={{ padding: 24, textAlign: 'center' }}>
              {conn === 'open' ? 'Waiting for events…' : 'Connecting to the event stream…'}
            </p>
          ) : (
            events.map((evt, i) => {
              const key = `${evt.timestamp}-${i}-${seqRef.current}`;
              const sClass = statusClass(evt.data.status);
              const cClass = cacheClass(evt.data.cache_status);
              const mClass = methodClass(evt.data.method);
              const isOpen = expanded === key;
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    className="row"
                    style={{ gap: 10, alignItems: 'center', padding: '7px 16px', cursor: 'pointer' }}
                    onClick={() => setExpanded((p) => (p === key ? null : key))}
                  >
                    <span className="text-subtle" style={{ width: 84, flexShrink: 0 }}>
                      {clockTime(evt.timestamp)}
                    </span>
                    <span className="badge" style={{ flexShrink: 0 }}>{evt.eventType}</span>
                    {evt.data.method ? (
                      <span className={`mono ${mClass}`} style={{ flexShrink: 0, fontWeight: 700 }}>
                        {str(evt.data.method)}
                      </span>
                    ) : null}
                    {sClass ? (
                      <span className={`stream-status ${sClass}`} style={{ flexShrink: 0 }}>
                        {str(evt.data.status)}
                      </span>
                    ) : null}
                    {cClass ? (
                      <span className={`badge ${cClass}`} style={{ flexShrink: 0 }}>
                        {str(evt.data.cache_status).toUpperCase()}
                      </span>
                    ) : null}
                    <span className="grow text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {summary(evt)}
                    </span>
                    <span className="text-subtle" style={{ flexShrink: 0 }}>
                      <Icon name={isOpen ? 'chevDown' : 'chev'} size={14} />
                    </span>
                  </div>
                  {isOpen && (
                    <pre
                      className="mono text-muted"
                      style={{
                        margin: 0,
                        padding: '10px 16px 14px 110px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        background: 'var(--surface-2)',
                        fontSize: 11.5,
                        lineHeight: 1.55,
                      }}
                    >
                      {JSON.stringify(evt.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </>
  );
}
