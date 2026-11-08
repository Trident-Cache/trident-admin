import Link from 'next/link';
import {
  trident,
  fetchMetricsSnapshot,
  fetchPrometheusSamples,
  sumByName,
  groupByLabel,
} from '@/lib/trident';
import {
  AreaChart,
  Badge,
  Card,
  Icon,
  PageHead,
  Progress,
  Ring,
  StatCard,
} from '@/components/ui/primitives';
import { formatBytes, formatNumber, formatMs } from '@/lib/format';

export const dynamic = 'force-dynamic';

const BYPASS_REASONS: Array<{ key: string; label: string; metric: string }> = [
  { key: 'no_cache', label: 'no_cache', metric: 'bypass_no_cache' },
  { key: 'no_store', label: 'no_store', metric: 'bypass_no_store' },
  { key: 'pragma', label: 'pragma', metric: 'bypass_pragma' },
  { key: 'authorization', label: 'authorization', metric: 'bypass_authorization' },
  { key: 'cookie', label: 'cookie', metric: 'bypass_cookie' },
  { key: 'cookie_name', label: 'cookie_name', metric: 'bypass_cookie_name' },
  { key: 'range', label: 'range', metric: 'bypass_range' },
  { key: 'pass_path', label: 'pass_path', metric: 'bypass_pass_path' },
  { key: 'query_param', label: 'query_param', metric: 'bypass_query_param' },
  { key: 'method', label: 'method', metric: 'bypass_method' },
];

function statusVariant(code: number): 'danger' | 'warn' | 'default' {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warn';
  return 'default';
}

function circuitVariant(state: string): 'success' | 'danger' | 'warn' {
  if (state === 'closed') return 'success';
  if (state === 'open') return 'danger';
  return 'warn';
}

export default async function StatsPage() {
  const [
    stats,
    latency,
    errors,
    protection,
    memory,
    connections,
    topUrls,
    refreshQueue,
    snapshot,
    prometheus,
    config,
    denoisers,
  ] = await Promise.all([
    trident.stats().catch(() => null),
    trident.latencyStats().catch(() => null),
    trident.errorStats(20).catch(() => null),
    trident.protectionStats().catch(() => null),
    trident.memoryStats().catch(() => null),
    trident.connections().catch(() => null),
    trident.topUrls(15, 'hits').catch(() => null),
    trident.getRefreshQueueStats().catch(() => null),
    fetchMetricsSnapshot().catch(() => null),
    fetchPrometheusSamples().catch(() => []),
    trident.config().catch(() => null),
    trident.denoiserReport().catch(() => null),
  ]);

  if (!latency && !memory && !stats) {
    return (
      <>
        <PageHead title="Statistics" sub="Cache, latency, memory and protection metrics." />
        <div className="banner banner-danger">
          <Icon name="info" size={16} /> Cannot load statistics — make sure Trident is running.
        </div>
      </>
    );
  }

  const cacheCounters = snapshot?.cache;
  const detailedMemory = snapshot?.memory;

  // Hit ratio (prefer live snapshot, fall back to /stats counters)
  const hits = cacheCounters?.hits ?? stats?.hits ?? 0;
  const misses = cacheCounters?.misses ?? stats?.misses ?? 0;
  const totalReq = hits + misses;
  const hitRatio =
    cacheCounters?.hit_ratio != null
      ? cacheCounters.hit_ratio * (cacheCounters.hit_ratio <= 1 ? 100 : 1)
      : totalReq > 0
        ? (hits / totalReq) * 100
        : 0;

  const errorList = errors?.errors ?? [];
  const totalErrors = errors?.totalErrors ?? 0;
  const errorRate = totalReq > 0 ? (totalErrors / totalReq) * 100 : 0;

  const protectionBackends = protection?.backends ?? {};
  const pools = connections?.pools ?? [];
  const urls = topUrls?.urls ?? [];

  const tlsHandshakeFailures = sumByName(prometheus, 'trident_tls_handshake_failure_total');
  const tlsHandshakeTimeouts = sumByName(prometheus, 'trident_tls_handshake_timeout_total');
  const connLimitByScope = groupByLabel(prometheus, 'trident_connection_limit_rejected_total', 'scope');
  const connLimitByAction = groupByLabel(prometheus, 'trident_connection_limit_rejected_total', 'action');

  const cfgAny = config as any;
  const poisoning = cfgAny?.cache?.poisoning;

  const lat = latency?.latency;
  const latBuckets = lat
    ? [
        { label: 'p50', ms: lat.p50Ms },
        { label: 'p90', ms: lat.p90Ms },
        { label: 'p99', ms: lat.p99Ms },
        { label: 'avg', ms: lat.avgMs },
        { label: 'max', ms: lat.maxMs },
      ]
    : [];

  // Real /admin/memory shape: { snapshot: { categories[], allocator, tracked*, untracked* }, footprintPercentiles }.
  const memSnap = memory?.snapshot ?? null;
  const memRss = memSnap?.allocator.rssBytes ?? 0;
  const memTrackedCapacity = memSnap?.trackedCapacityBytes ?? 0;
  // Fraction of RSS that Trident's registry accounts for (capacity vs RSS).
  const trackedPct = memSnap && memRss > 0 ? Math.min(100, (memTrackedCapacity / memRss) * 100) : 0;
  const untrackedPct = memSnap ? memSnap.untrackedFraction * 100 : 0;
  // Top categories by logical bytes (drop empties), for the breakdown table.
  const topCategories = memSnap
    ? [...memSnap.categories]
        .filter((c) => c.logicalBytes > 0)
        .sort((a, b) => b.logicalBytes - a.logicalBytes)
    : [];

  return (
    <>
      <PageHead
        title="Statistics"
        sub="Cache performance, latency percentiles, memory layout, errors and backend protection."
      />

      {/* Top stat row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard
          label="Requests"
          value={latency ? formatNumber(latency.requestCount) : totalReq ? formatNumber(totalReq) : '—'}
          hint="sampled"
        />
        <StatCard
          label="Hit ratio"
          value={totalReq > 0 || cacheCounters ? `${hitRatio.toFixed(1)}` : '—'}
          unit="%"
          hint={`${formatNumber(hits)} hits / ${formatNumber(misses)} miss`}
        />
        <StatCard
          label="Cached entries"
          value={stats ? formatNumber(stats.entries) : cacheCounters?.entries != null ? formatNumber(cacheCounters.entries) : '—'}
          hint={stats ? `${formatNumber(stats.evictions)} evicted` : undefined}
        />
        <StatCard
          label="p99 latency"
          value={lat ? formatMs(lat.p99Ms) : '—'}
          hint={lat ? `p50 ${formatMs(lat.p50Ms)}` : undefined}
        />
      </div>

      {/* Latency + hit ratio */}
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        {lat && (
          <Card title={<><Icon name="stats" size={14} /> Latency percentiles</>} sub={`${formatNumber(latency!.requestCount)} requests sampled`}>
            <AreaChart data={[lat.p50Ms, lat.p90Ms, lat.p99Ms, lat.maxMs]} height={140} />
            <div className="table-wrapper" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr><th>Bucket</th><th className="right">Latency</th></tr>
                </thead>
                <tbody>
                  {latBuckets.map((b) => (
                    <tr key={b.label}>
                      <td className="mono">{b.label}</td>
                      <td className="right tnum mono">{formatMs(b.ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card title={<><Icon name="cache" size={14} /> Cache hit ratio</>} sub="hits vs misses since start">
          <div className="row" style={{ gap: 24, alignItems: 'center' }}>
            <Ring value={hitRatio} max={100} label="%" size={120} />
            <div className="col" style={{ gap: 10, fontSize: 13 }}>
              <div><strong className="tnum">{formatNumber(hits)}</strong> <span className="text-subtle">hits</span></div>
              <div><strong className="tnum">{formatNumber(misses)}</strong> <span className="text-subtle">misses</span></div>
              {cacheCounters?.stale_hits != null && (
                <div><strong className="tnum">{formatNumber(cacheCounters.stale_hits)}</strong> <span className="text-subtle">stale hits</span></div>
              )}
              {cacheCounters?.pass_mode_count != null && (
                <div><strong className="tnum">{formatNumber(cacheCounters.pass_mode_count)}</strong> <span className="text-subtle">PASS</span></div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Refresh queue */}
      {refreshQueue && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
          <StatCard label="Refresh pending" value={formatNumber(refreshQueue.pending)} hint="queued" />
          <StatCard label="Processing" value={formatNumber(refreshQueue.processing)} hint="in flight" />
          <StatCard label="Completed" value={formatNumber(refreshQueue.completed)} hint="background refreshes" />
          <StatCard label="Failed" value={formatNumber(refreshQueue.failed)} hint="refresh errors" />
        </div>
      )}

      {/* Memory breakdown (GET /admin/memory snapshot) */}
      {memSnap && (
        <Card
          title={<><Icon name="config" size={14} /> Memory breakdown</>}
          sub={`${formatBytes(memTrackedCapacity)} tracked of ${formatBytes(memRss)} RSS · ${untrackedPct.toFixed(1)}% untracked`}
          className="col-span-3"
        >
          <div style={{ marginBottom: 12 }}>
            <Progress value={trackedPct} variant={untrackedPct > 50 ? 'warn' : undefined} />
          </div>
          <div className="grid-4" style={{ marginBottom: 8 }}>
            <div><div className="stat-label">Process RSS</div><div className="stat-value tnum mono" style={{ fontSize: 16 }}>{formatBytes(memRss)}</div></div>
            <div><div className="stat-label">Tracked (logical)</div><div className="stat-value tnum mono" style={{ fontSize: 16 }}>{formatBytes(memSnap.trackedLogicalBytes)}</div></div>
            <div><div className="stat-label">Tracked (capacity)</div><div className="stat-value tnum mono" style={{ fontSize: 16 }}>{formatBytes(memTrackedCapacity)}</div></div>
            <div><div className="stat-label">Untracked</div><div className="stat-value tnum mono" style={{ fontSize: 16 }}>{formatBytes(memSnap.untrackedBytes)}</div></div>
          </div>
          <div className="grid-4" style={{ marginBottom: 8 }}>
            <div><div className="stat-label">Peak RSS</div><div className="mono tnum">{formatBytes(memSnap.allocator.peakRssBytes)}</div></div>
            <div><div className="stat-label">Committed</div><div className="mono tnum">{formatBytes(memSnap.allocator.mimallocCommittedBytes)}</div></div>
            <div><div className="stat-label">Peak committed</div><div className="mono tnum">{formatBytes(memSnap.allocator.peakCommittedBytes)}</div></div>
            <div><div className="stat-label">Untracked share</div><div className="mono tnum">{untrackedPct.toFixed(1)}%</div></div>
          </div>
          {memory?.footprintPercentiles && memory.footprintPercentiles.count > 0 && (
            <p className="help-text" style={{ marginTop: 4 }}>
              Per-entry footprint over <strong className="tnum">{formatNumber(memory.footprintPercentiles.count)}</strong> sampled entries:
              {' '}p50 <strong className="tnum mono">{formatBytes(memory.footprintPercentiles.p50)}</strong>
              {' · '}p95 <strong className="tnum mono">{formatBytes(memory.footprintPercentiles.p95)}</strong>
              {' · '}p99 <strong className="tnum mono">{formatBytes(memory.footprintPercentiles.p99)}</strong>
            </p>
          )}
          {topCategories.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Band</th>
                    <th className="right">Logical</th>
                    <th className="right">Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {topCategories.map((c) => (
                    <tr key={c.category}>
                      <td className="mono">{c.category}</td>
                      <td><Badge variant={c.band === 'resident' ? 'info' : 'default'}>{c.band}</Badge></td>
                      <td className="right tnum mono">{formatBytes(c.logicalBytes)}</td>
                      <td className="right tnum mono">{c.capacityBytes != null ? formatBytes(c.capacityBytes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Detailed memory (snapshot) */}
      {detailedMemory && (
        <Card
          title={<><Icon name="config" size={14} /> Memory breakdown (detailed)</>}
          sub="Per-component allocation tracked by Trident vs process RSS — shows allocator fragmentation."
          className="col-span-3"
        >
          <div className="grid-4">
            <div><div className="stat-label">Entry bodies</div><div className="mono tnum">{formatBytes(detailedMemory.entry_body_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Entry headers</div><div className="mono tnum">{formatBytes(detailedMemory.entry_header_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Entry keys</div><div className="mono tnum">{formatBytes(detailedMemory.entry_key_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Per-entry overhead</div><div className="mono tnum">{formatBytes(detailedMemory.entry_overhead_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Tag index</div><div className="mono tnum">{formatBytes(detailedMemory.tag_index_bytes ?? 0)}</div></div>
            <div><div className="stat-label">URL index</div><div className="mono tnum">{formatBytes(detailedMemory.url_index_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Shard overhead</div><div className="mono tnum">{formatBytes(detailedMemory.shard_overhead_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Tracked total</div><div className="mono tnum">{formatBytes(detailedMemory.tracked_total_bytes ?? 0)}</div></div>
          </div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="grid-3">
            <div><div className="stat-label">Process RSS</div><div className="mono tnum">{formatBytes(detailedMemory.process_rss_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Process RSS peak</div><div className="mono tnum">{formatBytes(detailedMemory.process_rss_peak_bytes ?? 0)}</div></div>
            <div><div className="stat-label">Untracked (alloc + code + stacks)</div><div className="mono tnum">{formatBytes(Math.max(0, detailedMemory.untracked_bytes ?? 0))}</div></div>
          </div>
          {detailedMemory.allocator && (
            <>
              <div className="divider" style={{ margin: '14px 0' }} />
              <div className="text-subtle" style={{ fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>mimalloc allocator</div>
              <div className="grid-3">
                <div><div className="stat-label">Committed</div><div className="mono tnum">{formatBytes(detailedMemory.allocator.committed_bytes ?? 0)}</div></div>
                <div><div className="stat-label">Peak committed</div><div className="mono tnum">{formatBytes(detailedMemory.allocator.peak_committed_bytes ?? 0)}</div></div>
                <div><div className="stat-label">Page faults</div><div className="mono tnum">{formatNumber(detailedMemory.allocator.page_faults ?? 0)}</div></div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Top URLs */}
      {urls.length > 0 && (
        <Card title={<><Icon name="cache" size={14} /> Top URLs by hits</>} sub={`${formatNumber(topUrls?.total ?? urls.length)} tracked`} className="col-span-3">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Host</th>
                  <th className="right">Hits</th>
                  <th className="right">Bytes</th>
                  <th className="right">Last access</th>
                </tr>
              </thead>
              <tbody>
                {urls.map((u, i) => (
                  <tr key={`${u.host}${u.url}${i}`}>
                    <td className="mono" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</td>
                    <td className="mono text-subtle">{u.host || '—'}</td>
                    <td className="right tnum">{formatNumber(u.hits)}</td>
                    <td className="right tnum">{formatBytes(u.bytes)}</td>
                    <td className="right text-subtle">{u.lastAccess || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Errors */}
      {(totalErrors > 0 || errorList.length > 0) && (
        <Card
          title={<><Icon name="info" size={14} /> Errors</>}
          sub={`${formatNumber(totalErrors)} total · ${errorRate.toFixed(3)}% rate`}
          className="col-span-3"
        >
          {errorList.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status</th>
                    <th className="right">Count</th>
                    <th className="right">Last occurred</th>
                  </tr>
                </thead>
                <tbody>
                  {errorList.map((e, i) => (
                    <tr key={`${e.url}${e.statusCode}${i}`}>
                      <td className="mono" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</td>
                      <td><Badge variant={statusVariant(e.statusCode)}>{e.statusCode}</Badge></td>
                      <td className="right tnum">{formatNumber(e.count)}</td>
                      <td className="right text-subtle">{e.lastOccurred || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No recorded errors.</p>
          )}
        </Card>
      )}

      {/* Backend protection */}
      {Object.keys(protectionBackends).length > 0 && (
        <Card title={<><Icon name="backends" size={14} /> Backend protection</>} sub="Circuit-breaker state per backend." className="col-span-3">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Backend</th>
                  <th>Circuit</th>
                  <th className="right">Failures</th>
                  <th className="right">Successes</th>
                  <th className="right">Last failure</th>
                  <th className="right">Cooldown ends</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(protectionBackends).map(([name, info]) => (
                  <tr key={name}>
                    <td className="mono">{name}</td>
                    <td><Badge variant={circuitVariant(info.circuitState)} dot>{info.circuitState}</Badge></td>
                    <td className="right tnum">{formatNumber(info.failureCount)}</td>
                    <td className="right tnum">{formatNumber(info.successCount)}</td>
                    <td className="right text-subtle">{info.lastFailure || '—'}</td>
                    <td className="right text-subtle">{info.cooldownEndsAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Connection pools */}
      {pools.length > 0 && (
        <Card
          title={<><Icon name="backends" size={14} /> Connection pools</>}
          sub={`${formatNumber(connections?.totalActive ?? 0)} active · ${formatNumber(connections?.totalIdle ?? 0)} idle`}
          className="col-span-3"
        >
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Backend</th>
                  <th className="right">Active</th>
                  <th className="right">Idle</th>
                  <th className="right">Max</th>
                  <th className="right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <tr key={pool.backend}>
                    <td className="mono">{pool.backend}</td>
                    <td className="right tnum">{formatNumber(pool.active)}</td>
                    <td className="right tnum">{formatNumber(pool.idle)}</td>
                    <td className="right">{pool.maxConnections === 0 ? <Badge variant="info">unlimited</Badge> : formatNumber(pool.maxConnections)}</td>
                    <td className="right tnum">{formatNumber(pool.waitingRequests)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Bypass reasons */}
      {cacheCounters && (
        <Card
          title={<><Icon name="filter" size={14} /> Cache bypasses by reason</>}
          sub="Why requests bypassed the cache — client-driven vs config-driven."
          className="col-span-3"
        >
          <div className="grid-4">
            {BYPASS_REASONS.map(({ key, label, metric }) => {
              const v = (cacheCounters as Record<string, number | undefined>)[metric] ?? 0;
              return (
                <div key={key}>
                  <div className="stat-label">{label}</div>
                  <div className="mono tnum">{formatNumber(v)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Denoisers */}
      {denoisers && (
        <Card
          title={<><Icon name="denoise" size={14} /> Denoisers</>}
          sub="Path zone classifications and query parameter learning state."
          actions={<Link className="btn btn-ghost btn-sm" href="/denoisers"><Icon name="chev" size={13} /> Manage</Link>}
          className="col-span-3"
        >
          <div className="grid-2">
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="label-text">Path denoiser</span>
                  <Badge variant={denoisers.pathDenoiser.enabled ? 'success' : 'default'} dot>{denoisers.pathDenoiser.enabled ? 'enabled' : 'disabled'}</Badge>
                </div>
                <div className="grid-3">
                  <div><div className="stat-label">Dead</div><div className="mono tnum text-danger">{formatNumber(denoisers.pathDenoiser.zonesDead)}</div></div>
                  <div><div className="stat-label">Alive</div><div className="mono tnum text-success">{formatNumber(denoisers.pathDenoiser.zonesAlive)}</div></div>
                  <div><div className="stat-label">Learning</div><div className="mono tnum text-warn">{formatNumber(denoisers.pathDenoiser.zonesLearning)}</div></div>
                </div>
              </div>
            </div>
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="label-text">Query denoiser</span>
                  <Badge variant={denoisers.queryDenoiser.enabled ? 'success' : 'default'} dot>{denoisers.queryDenoiser.enabled ? 'enabled' : 'disabled'}</Badge>
                </div>
                <div className="grid-3">
                  <div><div className="stat-label">Scopes</div><div className="mono tnum">{formatNumber(denoisers.queryDenoiser.scopes)}</div></div>
                  <div><div className="stat-label">Noise params</div><div className="mono tnum text-warn">{formatNumber(denoisers.queryDenoiser.paramsNoise)}</div></div>
                  <div><div className="stat-label">Signal params</div><div className="mono tnum text-success">{formatNumber(denoisers.queryDenoiser.paramsSignal)}</div></div>
                </div>
                {(() => {
                  const stripped = sumByName(prometheus, 'trident_query_denoiser_params_stripped_total');
                  return stripped > 0 ? (
                    <p className="help-text" style={{ marginTop: 10 }}>
                      <strong className="tnum">{formatNumber(stripped)}</strong> tracking params stripped from cache keys
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TLS & connection limit */}
      <Card
        title={<><Icon name="dns" size={14} /> TLS &amp; connection limit</>}
        sub="Listener-level counters from the Prometheus endpoint."
        className="col-span-3"
      >
        {prometheus.length === 0 ? (
          <div className="banner banner-warn">
            <Icon name="info" size={16} /> Metrics endpoint unreachable. Set <code className="mono">TRIDENT_METRICS_URL</code> in your environment.
          </div>
        ) : (
          <>
            <div className="grid-4">
              <div><div className="stat-label">TLS handshake failures</div><div className="mono tnum">{formatNumber(tlsHandshakeFailures)}</div></div>
              <div><div className="stat-label">TLS handshake timeouts</div><div className="mono tnum">{formatNumber(tlsHandshakeTimeouts)}</div></div>
              <div><div className="stat-label">Conn-limit (global)</div><div className="mono tnum">{formatNumber(connLimitByScope.find((r) => r.label === 'global')?.value ?? 0)}</div></div>
              <div><div className="stat-label">Conn-limit (per-IP)</div><div className="mono tnum">{formatNumber(connLimitByScope.find((r) => r.label === 'per_ip')?.value ?? 0)}</div></div>
            </div>
            {connLimitByAction.length > 0 && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                <span className="text-subtle" style={{ fontSize: 12.5 }}>By action:</span>
                {connLimitByAction.map((r) => (
                  <Badge key={r.label || '(none)'} variant="default">{r.label || '(none)'}: {formatNumber(r.value)}</Badge>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Cache poisoning guard */}
      {poisoning && (
        <Card
          title={<><Icon name="bans" size={14} /> Cache poisoning guard</>}
          sub="Strips suspicious headers, validates Host, refuses dangerous Vary values. Configured in [cache.poisoning]."
          className="col-span-3"
        >
          <div className="grid-3">
            <div>
              <div className="stat-label">Enabled</div>
              <Badge variant={poisoning.enabled ? 'success' : 'default'}>{poisoning.enabled ? 'yes' : 'no'}</Badge>
            </div>
            <div>
              <div className="stat-label">Known hosts</div>
              {Array.isArray(poisoning.knownHosts) && poisoning.knownHosts.length > 0 ? (
                <div className="mono tnum">{poisoning.knownHosts.length} configured</div>
              ) : (
                <div className="text-warn" style={{ fontSize: 13 }}>empty (rejects all on non-loopback)</div>
              )}
            </div>
            <div>
              <div className="stat-label">Strip suspicious headers</div>
              <Badge variant={poisoning.stripSuspiciousHeaders ? 'success' : 'default'}>{poisoning.stripSuspiciousHeaders ? 'yes' : 'no'}</Badge>
            </div>
          </div>
          {Array.isArray(poisoning.knownHosts) && poisoning.knownHosts.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {poisoning.knownHosts.map((h: string) => (
                <Badge key={h} variant="info">{h}</Badge>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
