import Link from 'next/link';
import { trident } from '@/lib/trident';
import { Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface TagsPageProps {
  searchParams: { filter?: string; offset?: string };
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const filter = searchParams.filter || '';
  const offset = Number(searchParams.offset) || 0;
  const limit = 100;

  let tagsData: Awaited<ReturnType<typeof trident.cacheTags>> | null = null;
  let stats: Awaited<ReturnType<typeof trident.tagStats>> | null = null;
  let loadErr: string | null = null;
  try {
    [tagsData, stats] = await Promise.all([
      trident.cacheTags(limit, offset, filter || undefined),
      trident.tagStats().catch(() => null),
    ]);
  } catch (e) {
    loadErr = e instanceof Error ? e.message : 'Make sure Trident is running.';
  }

  const qs = (off: number) => {
    const p = new URLSearchParams();
    if (filter) p.set('filter', filter);
    p.set('offset', String(off));
    return `/cache/tags?${p.toString()}`;
  };

  return (
    <>
      <PageHead
        title="Cache Tags"
        sub="Tag-based invalidation groups — each tag maps to the set of entries it can purge."
        actions={
          <Link href="/cache" className="btn btn-secondary">
            <Icon name="cache" size={14} /> Back to Entries
          </Link>
        }
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot load cache tags: {loadErr}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard label="Tags" value={tagsData ? formatNumber(tagsData.total) : '—'} hint={filter ? 'matching filter' : 'total'} />
        <StatCard label="Tagged entries" value={stats ? formatNumber(stats.totalEntries) : '—'} hint="across all tags" />
        <StatCard label="Avg entries / tag" value={stats ? stats.avgEntriesPerTag.toFixed(1) : '—'} hint="mean" />
        <StatCard label="Filter" value={<span className="mono" style={{ fontSize: 14 }}>{filter || '—'}</span>} hint={filter ? 'active' : 'none'} />
      </div>

      <Card title={<><Icon name="search" size={14} /> Filter tags</>} sub="Match tags by name.">
        <form className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow">
            <label className="label-text" htmlFor="tag-filter">Tag name</label>
            <input
              id="tag-filter"
              name="filter"
              className="input mono"
              placeholder="product-42"
              defaultValue={filter}
            />
          </div>
          {/* Reset offset to 0 whenever a new filter is submitted. */}
          <input type="hidden" name="offset" value="0" />
          <button type="submit" className="btn btn-primary">
            <Icon name="filter" size={14} /> Filter
          </button>
        </form>
        <p className="help-text">Leave blank to list all tags.</p>
      </Card>

      <div style={{ marginTop: 16 }}>
        {!tagsData || tagsData.tags.length === 0 ? (
          <Card title={<><Icon name="bans" size={14} /> Tags</>}>
            <p className="text-muted">{filter ? 'No tags match this filter.' : 'No tags in the cache.'}</p>
          </Card>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th className="right">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {tagsData.tags.map((tag) => (
                    <tr key={tag.tag}>
                      <td><span className="badge badge-info mono">{tag.tag}</span></td>
                      <td className="right tnum">{formatNumber(tag.entryCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="text-subtle" style={{ fontSize: 12.5 }}>
                Showing <strong className="tnum">{offset + 1}</strong>–<strong className="tnum">{Math.min(offset + limit, tagsData.total)}</strong> of <strong className="tnum">{formatNumber(tagsData.total)}</strong>
              </span>
              <div className="row" style={{ gap: 8 }}>
                {offset > 0 && (
                  <Link href={qs(Math.max(0, offset - limit))} className="btn btn-secondary btn-sm">
                    <Icon name="chev" size={14} /> Previous
                  </Link>
                )}
                {tagsData.hasMore && (
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
