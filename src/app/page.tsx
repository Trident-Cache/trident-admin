import Link from 'next/link';
import { trident, fetchMetricsSnapshot, type MetricsSnapshot } from '@/lib/trident';
import { AreaChart, Card, Icon, PageHead, Ring, StatCard } from '@/components/ui/primitives';
import { formatBytes, formatNumber, formatDuration, formatMs } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [stats, health, memory, backends, latency, topUrls, metrics] = await Promise.all([
    trident.stats().catch(() => null),
    trident.health().catch(() => null),
    trident.memoryStats().catch(() => null),
    trident.backends().catch(() => null),
    trident.latencyStats().catch(() => null),
    trident.topUrls(8).catch(() => null),
    fetchMetricsSnapshot().catch((): MetricsSnapshot | null => null),
  ]);

  if (!stats) {
    return (
      <>
        <PageHead title="Dashboard" sub="Live overview of cache health, traffic, and memory." />
        <div className="banner banner-danger">
          <Icon name="info" size={16} />
          <span>
            <strong>Cannot reach Trident.</strong> Make sure the server is running and{' '}
            <code className="mono">TRIDENT_ADMIN_URL</code> points at the admin port.
          </span>
        </div>
      </>
    );
  }

  const totalReq = stats.hits + stats.misses;
  const hitRatioNum = totalReq > 0 ? (stats.hits / totalReq) * 100 : 0;

  // RSS / committed from the metrics snapshot when available, else the
  // allocator band on the /admin/memory snapshot, else the tracked cache memory.
  const memSnap = memory?.snapshot ?? null;
  const rss = metrics?.memory?.process_rss_bytes ?? memSnap?.allocator.rssBytes ?? null;
  const memUsed = rss ?? stats.memoryUsed;
  const memMax = stats.maxMemory || metrics?.cache?.memory_max || 0;
  const memPct = memMax > 0 ? (memUsed / memMax) * 100 : 0;

  const allBackends = backends?.backends ?? [];
  const healthy = allBackends.filter((b) => b.healthy && !b.drained).length;
  const total = allBackends.length;

  // Real data series: latency percentile distribution drives the trend chart + a spark.
  const lat = latency?.latency;
  const latSeries = lat ? [lat.p50Ms, lat.avgMs, lat.p90Ms, lat.p99Ms, lat.maxMs] : [];

  // Spark for the requests tile from the hit/miss split (two honest points).
  const reqSpark = totalReq > 0 ? [stats.misses, stats.hits] : undefined;

  const stale = metrics?.cache?.stale_hits ?? 0;
  const passMode = metrics?.cache?.pass_mode_count ?? 0;

  const serverHealthy = health?.status === 'healthy';

  return (
    <>
      <PageHead
        title="Dashboard"
        sub="Live overview of cache health, traffic, and memory."
        actions={
          <>
            <span className={`health-chip ${serverHealthy ? '' : 'is-down'}`}>
              <span className="dot" />
              {serverHealthy ? 'Operational' : 'Degraded'}
              {health?.version && <span className="text-subtle mono">v{health.version}</span>}
            </span>
            <Link href="/purge" className="btn btn-primary">
              <Icon name="purge" size={14} /> Purge
            </Link>
          </>
        }
      />

      {!metrics && (
        <div className="banner banner-info" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} />
          <span>
            Metrics server unreachable — RSS, stale hits and PASS counters are hidden. Set{' '}
            <code className="mono">TRIDENT_METRICS_URL</code> to enable them.
          </span>
        </div>
      )}

      {/* Headline KPIs */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard
          label="Hit ratio"
          value={hitRatioNum.toFixed(1)}
          unit="%"
          hint={`${formatNumber(stats.hits)} hits`}
        />
        <StatCard
          label="Requests"
          value={formatNumber(totalReq)}
          hint={`${formatNumber(stats.misses)} misses`}
          spark={reqSpark}
        />
        <StatCard
          label={rss ? 'Memory · RSS' : 'Memory'}
          value={formatBytes(memUsed)}
          hint={memMax > 0 ? `of ${formatBytes(memMax)}` : 'no cap'}
        />
        <StatCard
          label="Backends up"
          value={`${healthy}/${total}`}
          hint={total === 0 ? 'none configured' : healthy === total ? 'all healthy' : 'degraded'}
          deltaDir={total > 0 && healthy < total ? 'down' : undefined}
          delta={total > 0 && healthy < total ? `${total - healthy} down` : undefined}
        />
        <StatCard label="Entries" value={formatNumber(stats.entries)} hint={`${formatNumber(stats.evictions)} evicted`} />
        <StatCard label="Uptime" value={<span className="uptime">{formatDuration(stats.uptimeSecs)}</span>} hint="since boot" />
      </div>

      {/* Two-up: traffic / latency trend + backends health */}
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <Card
          title={<><Icon name="stats" size={14} /> Latency distribution</>}
          sub={lat ? `${formatNumber(latency!.requestCount)} requests sampled` : 'no latency data yet'}
          actions={<Link href="/stats" className="btn btn-ghost btn-sm">Details <Icon name="chev" size={13} /></Link>}
        >
          {latSeries.length > 1 ? (
            <>
              <AreaChart data={latSeries} height={160} />
              <div className="row" style={{ gap: 20, marginTop: 14, flexWrap: 'wrap', fontSize: 13 }}>
                <span><span className="text-subtle">p50</span> <strong className="tnum mono">{formatMs(lat!.p50Ms)}</strong></span>
                <span><span className="text-subtle">avg</span> <strong className="tnum mono">{formatMs(lat!.avgMs)}</strong></span>
                <span><span className="text-subtle">p90</span> <strong className="tnum mono">{formatMs(lat!.p90Ms)}</strong></span>
                <span><span className="text-subtle">p99</span> <strong className="tnum mono">{formatMs(lat!.p99Ms)}</strong></span>
                <span><span className="text-subtle">max</span> <strong className="tnum mono">{formatMs(lat!.maxMs)}</strong></span>
              </div>
            </>
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>No requests have been served yet.</p>
          )}
        </Card>

        <Card
          title={<><Icon name="cache" size={14} /> Cache effectiveness</>}
          sub="Share of requests served from cache."
        >
          <div className="row" style={{ gap: 24, alignItems: 'center' }}>
            <Ring value={hitRatioNum} label="%" size={120} thickness={10} />
            <div className="col" style={{ gap: 12, flex: 1 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="text-subtle">Hits</span>
                <strong className="tnum mono text-success">{formatNumber(stats.hits)}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="text-subtle">Misses</span>
                <strong className="tnum mono">{formatNumber(stats.misses)}</strong>
              </div>
              {metrics && (
                <>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="text-subtle">Stale (SWR)</span>
                    <strong className="tnum mono">{formatNumber(stale)}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="text-subtle">PASS mode</span>
                    <strong className="tnum mono">{formatNumber(passMode)}</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Memory + backends list */}
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <Card title={<><Icon name="dashboard" size={14} /> Memory</>} sub={memMax > 0 ? `${memPct.toFixed(1)}% of cap` : 'breakdown'}>
          {memSnap ? (
            <div className="table-wrapper">
              <table className="table">
                <tbody>
                  <tr><td className="muted">{rss ? 'Process RSS' : 'Tracked'}</td><td className="right num mono">{formatBytes(memUsed)}</td></tr>
                  <tr><td className="muted">Tracked (logical)</td><td className="right num mono">{formatBytes(memSnap.trackedLogicalBytes)}</td></tr>
                  <tr><td className="muted">Tracked (capacity)</td><td className="right num mono">{formatBytes(memSnap.trackedCapacityBytes)}</td></tr>
                  <tr><td className="muted">Untracked</td><td className="right num mono">{formatBytes(memSnap.untrackedBytes)}</td></tr>
                  <tr><td className="muted">Peak RSS</td><td className="right num mono">{formatBytes(memSnap.allocator.peakRssBytes)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>Memory breakdown unavailable.</p>
          )}
        </Card>

        <Card
          title={<><Icon name="backends" size={14} /> Backends</>}
          sub={total === 0 ? 'none configured' : `${healthy} of ${total} healthy`}
          actions={<Link href="/backends" className="btn btn-ghost btn-sm">Manage <Icon name="chev" size={13} /></Link>}
        >
          {total > 0 ? (
            <div className="col" style={{ gap: 8 }}>
              {allBackends.map((b) => {
                const down = !b.healthy || b.drained;
                return (
                  <div key={b.name} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 500 }}>{b.name}</span>
                      <span className="text-subtle mono" style={{ fontSize: 12 }}>{b.url}</span>
                    </div>
                    <span className={`health-chip ${down ? 'is-down' : ''}`}>
                      <span className="dot" />
                      {b.drained ? 'drained' : b.healthy ? 'healthy' : 'down'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>No backends configured.</p>
          )}
        </Card>
      </div>

      {/* Top URLs */}
      {topUrls && topUrls.urls.length > 0 && (
        <Card
          title={<><Icon name="stats" size={14} /> Top URLs</>}
          sub={`${formatNumber(topUrls.total)} tracked`}
          actions={<Link href="/cache" className="btn btn-ghost btn-sm">Browse cache <Icon name="chev" size={13} /></Link>}
        >
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Host</th>
                  <th className="right">Hits</th>
                  <th className="right">Size</th>
                  <th className="right">Last access</th>
                </tr>
              </thead>
              <tbody>
                {topUrls.urls.map((u, i) => (
                  <tr key={`${u.host}${u.url}${i}`}>
                    <td className="mono" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</td>
                    <td className="text-subtle mono">{u.host}</td>
                    <td className="right num tnum">{formatNumber(u.hits)}</td>
                    <td className="right num tnum">{formatBytes(u.bytes)}</td>
                    <td className="right text-subtle">{u.lastAccess}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
