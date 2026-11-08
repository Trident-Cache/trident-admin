import Link from 'next/link';
import { trident } from '@/lib/trident';
import { Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { formatBytes, formatDuration, formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface CachePageProps {
  searchParams: { filter?: string; offset?: string; limit?: string };
}

/** Seconds since createdAt, used for the "Age" column. */
function ageSeconds(createdAt: string): number | null {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

export default async function CachePage({ searchParams }: CachePageProps) {
  const filter = searchParams.filter || '';
  const offset = Number(searchParams.offset) || 0;
  const limit = Number(searchParams.limit) || 50;

  let entries: Awaited<ReturnType<typeof trident.cacheEntries>> | null = null;
  let loadErr: string | null = null;
  try {
    entries = await trident.cacheEntries(limit, offset, filter || undefined);
  } catch (e) {
    loadErr = e instanceof Error ? e.message : 'Make sure Trident is running.';
  }

  const qs = (off: number) => {
    const p = new URLSearchParams();
    if (filter) p.set('filter', filter);
    p.set('offset', String(off));
    p.set('limit', String(limit));
    return `/cache?${p.toString()}`;
  };

  return (
    <>
      <PageHead
        title="Cache Browser"
        sub="Inspect cached responses — filter by URL prefix, check TTL, size and age."
        actions={
          <Link href="/cache/tags" className="btn btn-secondary">
            <Icon name="bans" size={14} /> View Tags
          </Link>
        }
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot load cache entries: {loadErr}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard label="Entries" value={entries ? formatNumber(entries.total) : '—'} hint={filter ? 'matching filter' : 'cached'} />
        <StatCard label="On this page" value={entries ? entries.entries.length : '—'} hint={`offset ${offset}`} />
        <StatCard label="Page size" value={limit} hint="limit" />
        <StatCard label="Filter" value={<span className="mono" style={{ fontSize: 14 }}>{filter || '—'}</span>} hint={filter ? 'active' : 'none'} />
      </div>

      <Card
        title={<><Icon name="search" size={14} /> Filter entries</>}
        sub="Match cached entries by URL prefix."
      >
        <form className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow">
            <label className="label-text" htmlFor="cache-filter">URL prefix</label>
            <input
              id="cache-filter"
              name="filter"
              className="input mono"
              placeholder="https://example.com/products"
              defaultValue={filter}
            />
          </div>
          {/* Reset offset to 0 whenever a new filter is submitted. */}
          <input type="hidden" name="offset" value="0" />
          <input type="hidden" name="limit" value={limit} />
          <button type="submit" className="btn btn-primary">
            <Icon name="filter" size={14} /> Filter
          </button>
        </form>
        <p className="help-text">Leave blank to list all cached entries.</p>
      </Card>

      <div style={{ marginTop: 16 }}>
        {!entries || entries.entries.length === 0 ? (
          <Card title={<><Icon name="cache" size={14} /> Entries</>}>
            <p className="text-muted">{filter ? 'No cached entries match this filter.' : 'The cache is empty.'}</p>
          </Card>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Verdict</th>
                    <th>URL</th>
                    <th>Host</th>
                    <th>Method</th>
                    <th className="right">TTL</th>
                    <th className="right">Size</th>
                    <th className="right">Age</th>
                    <th className="right">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.entries.map((entry) => {
                    const age = ageSeconds(entry.createdAt);
                    return (
                      <tr key={entry.storageKey}>
                        <td><span className="badge cache-HIT">HIT</span></td>
                        <td className="mono" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.url}>{entry.url}</td>
                        <td className="mono">{entry.host || '—'}</td>
                        <td>{entry.method || 'GET'}</td>
                        <td className="right tnum">{entry.ttl > 0 ? formatDuration(entry.ttl) : '—'}</td>
                        <td className="right tnum">{formatBytes(entry.size)}</td>
                        <td className="right tnum">{age != null ? formatDuration(age) : '—'}</td>
                        <td className="right tnum">{entry.tags?.length ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="text-subtle" style={{ fontSize: 12.5 }}>
                Showing <strong className="tnum">{offset + 1}</strong>–<strong className="tnum">{Math.min(offset + limit, entries.total)}</strong> of <strong className="tnum">{formatNumber(entries.total)}</strong>
              </span>
              <div className="row" style={{ gap: 8 }}>
                {offset > 0 && (
                  <Link href={qs(Math.max(0, offset - limit))} className="btn btn-secondary btn-sm">
                    <Icon name="chev" size={14} /> Previous
                  </Link>
                )}
                {entries.hasMore && (
                  <Link href={qs(offset + limit)} className="btn btn-secondary btn-sm">
                    Next <Icon name="chev" size={14} />
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
