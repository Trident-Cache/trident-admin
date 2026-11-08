import { trident } from '@/lib/trident';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { formatNumber, formatMs } from '@/lib/format';

// These response shapes are declared in the SDK's types module but are not
// re-exported from the '@trident-cache/sdk' package entry, so we mirror the
// fields we render here to keep this screen self-contained.
interface BackendInfo {
  name: string;
  url: string;
  healthy: boolean;
  weight: number;
  drained: boolean;
}

interface BackendDetailResponse {
  name: string;
  url: string;
  healthy: boolean;
  weight: number;
  drained: boolean;
  totalRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  activeConnections: number;
  circuitState: 'closed' | 'open' | 'half-open';
}

interface ConnectionPoolInfo {
  backend: string;
  active: number;
  idle: number;
  maxConnections: number;
  waitingRequests: number;
}

interface ConnectionsResponse {
  pools: ConnectionPoolInfo[];
  totalActive: number;
  totalIdle: number;
}

export const dynamic = 'force-dynamic';

export default async function BackendsPage() {
  let backendsList: BackendInfo[] = [];
  let loadErr: string | null = null;

  try {
    const data = await trident.backends();
    backendsList = data?.backends ?? [];
  } catch (e) {
    loadErr = e instanceof Error ? e.message : 'failed to load backends';
  }

  // Per-backend detail + connection pools, in parallel; individual failures ignored.
  const details: Record<string, BackendDetailResponse> = {};
  let connections: ConnectionsResponse | null = null;
  if (!loadErr) {
    const [, conns] = await Promise.all([
      Promise.all(
        backendsList.map(async (b) => {
          try {
            details[b.name] = await trident.backendDetail(b.name);
          } catch {
            /* ignore individual backend failures */
          }
        }),
      ),
      trident.connections().catch(() => null),
    ]);
    connections = conns;
  }

  const pools = connections?.pools ?? [];

  const totalRequests = Object.values(details).reduce((s, d) => s + (d.totalRequests ?? 0), 0);
  const totalErrors = Object.values(details).reduce((s, d) => s + (d.failedRequests ?? 0), 0);
  const healthyCount = backendsList.filter((b) => b.healthy && !b.drained).length;

  return (
    <>
      <PageHead
        title="Backends"
        sub="Origin servers behind Trident — health, weight, traffic, latency and connection pools."
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot reach backends API: {loadErr}
        </div>
      )}

      {!loadErr && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
          <StatCard
            label="Backends"
            value={backendsList.length}
            hint={`${healthyCount} healthy`}
          />
          <StatCard label="Total requests" value={formatNumber(totalRequests)} hint="across pool" />
          <StatCard label="Errors" value={formatNumber(totalErrors)} hint="failed requests" />
          <StatCard
            label="Active conns"
            value={connections ? formatNumber(connections.totalActive) : '—'}
            hint={connections ? `${formatNumber(connections.totalIdle)} idle` : 'no pool data'}
          />
        </div>
      )}

      {!loadErr && backendsList.length === 0 && (
        <Card title={<><Icon name="backends" size={14} /> Backends</>}>
          <p className="text-muted">No backends configured. Add backends to your Trident configuration.</p>
        </Card>
      )}

      {backendsList.length > 0 && (
        <div className="grid-3" style={{ alignItems: 'start' }}>
          {backendsList.map((b) => {
            const d = details[b.name];
            const drained = b.drained;
            const healthy = b.healthy && !drained;
            return (
              <Card
                key={b.name}
                title={
                  <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <Icon name="backends" size={14} /> {b.name}
                  </span>
                }
                sub={b.url}
                actions={
                  <Badge variant={drained ? 'warn' : healthy ? 'success' : 'danger'} dot>
                    {drained ? 'drained' : healthy ? 'healthy' : 'unhealthy'}
                  </Badge>
                }
              >
                <table className="table">
                  <tbody>
                    <tr>
                      <td className="muted">Weight</td>
                      <td className="right num tnum">{b.weight}</td>
                    </tr>
                    <tr>
                      <td className="muted">Requests</td>
                      <td className="right num tnum">{formatNumber(d?.totalRequests ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="muted">Errors</td>
                      <td className="right num tnum">{formatNumber(d?.failedRequests ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="muted">Avg latency</td>
                      <td className="right num tnum">{d ? formatMs(d.avgResponseTimeMs) : '—'}</td>
                    </tr>
                    <tr>
                      <td className="muted">Active conns</td>
                      <td className="right num tnum">{formatNumber(d?.activeConnections ?? 0)}</td>
                    </tr>
                    {d?.circuitState && (
                      <tr>
                        <td className="muted">Circuit</td>
                        <td className="right">
                          <span className="mono" style={{ fontSize: 12.5 }}>{d.circuitState}</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}

      {pools.length > 0 && (
        <Card
          title={<><Icon name="dns" size={14} /> Connection pools</>}
          sub={`${formatNumber(connections?.totalActive ?? 0)} active · ${formatNumber(connections?.totalIdle ?? 0)} idle`}
          className="col-span-3"
          padded={false}
        >
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Backend</th>
                  <th className="tnum">Active</th>
                  <th className="tnum">Idle</th>
                  <th className="tnum">Max</th>
                  <th className="tnum">Queued</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <tr key={pool.backend}>
                    <td className="mono">{pool.backend}</td>
                    <td className="tnum">{formatNumber(pool.active)}</td>
                    <td className="tnum">{formatNumber(pool.idle)}</td>
                    <td className="tnum">{formatNumber(pool.maxConnections)}</td>
                    <td className="tnum">{formatNumber(pool.waitingRequests)}</td>
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
