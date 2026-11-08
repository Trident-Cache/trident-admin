'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DenoiserReportResponse,
  QueryScopeDetail,
  PathZoneDetail,
  WafExportResponse,
} from '@trident-cache/sdk';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatNumber } from '@/lib/format';

type ActionResult = { ok: boolean; message: string } | null;

/** Scope/zone keys are encoded as 'host|path_prefix'. */
function splitKey(key: string): { host: string; pathPrefix: string } {
  const i = key.indexOf('|');
  if (i < 0) return { host: '*', pathPrefix: key || '/' };
  return { host: key.slice(0, i) || '*', pathPrefix: key.slice(i + 1) || '/' };
}

function statusVariant(status: string): 'success' | 'danger' | 'warn' | 'default' {
  switch (status) {
    case 'alive': return 'success';
    case 'dead': return 'danger';
    case 'learning': return 'warn';
    default: return 'default';
  }
}

export default function DenoisersPage() {
  const [report, setReport] = useState<DenoiserReportResponse | null>(null);
  const [scopes, setScopes] = useState<QueryScopeDetail[]>([]);
  const [zones, setZones] = useState<PathZoneDetail[]>([]);
  const [waf, setWaf] = useState<WafExportResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);
  const [tab, setTab] = useState<'query' | 'path'>('query');

  const load = useCallback(async () => {
    try {
      const [rRes, qRes, pRes] = await Promise.all([
        fetch(apiUrl('/api/denoisers/report'), { cache: 'no-store' }),
        fetch(apiUrl('/api/denoisers/query-scopes'), { cache: 'no-store' }),
        fetch(apiUrl('/api/denoisers/path-zones'), { cache: 'no-store' }),
      ]);
      const [rData, qData, pData] = await Promise.all([rRes.json(), qRes.json(), pRes.json()]);
      if (!rRes.ok) throw new Error(rData?.error || `status ${rRes.status}`);
      if (!qRes.ok) throw new Error(qData?.error || `status ${qRes.status}`);
      if (!pRes.ok) throw new Error(pData?.error || `status ${pRes.status}`);
      setReport(rData);
      setScopes(Array.isArray(qData) ? qData : []);
      setZones(Array.isArray(pData) ? pData : []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load denoiser report');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const dispatch = useCallback(async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/denoisers/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
      return data;
    } finally {
      setBusy(null);
      load();
    }
  }, [load]);

  const onQueryPin = async (param: string, cls: 'noise' | 'signal', scopeKey: string) => {
    const { host, pathPrefix } = splitKey(scopeKey);
    try {
      await dispatch(`qpin:${scopeKey}:${param}`, { action: 'query-pin', param, class: cls, host, pathPrefix });
      setResult({ ok: true, message: `Pinned "${param}" as ${cls} for ${host}${pathPrefix}.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onQueryUnpin = async (param: string, scopeKey: string) => {
    const { host, pathPrefix } = splitKey(scopeKey);
    try {
      await dispatch(`qunpin:${scopeKey}:${param}`, { action: 'query-unpin', param, host, pathPrefix });
      setResult({ ok: true, message: `Unpinned "${param}" for ${host}${pathPrefix} — back to learning.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onPathPin = async (zoneKey: string, status: 'dead' | 'alive') => {
    const { host, pathPrefix } = splitKey(zoneKey);
    try {
      await dispatch(`ppin:${zoneKey}:${status}`, { action: 'path-pin', status, host, pathPrefix });
      setResult({ ok: true, message: `Pinned zone ${host}${pathPrefix} as ${status}.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onPathUnpin = async (zoneKey: string) => {
    const { host, pathPrefix } = splitKey(zoneKey);
    try {
      await dispatch(`punpin:${zoneKey}`, { action: 'path-unpin', host, pathPrefix });
      setResult({ ok: true, message: `Unpinned zone ${host}${pathPrefix} — back to learning.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onQueryDelete = async (scopeKey: string) => {
    const { host, pathPrefix } = splitKey(scopeKey);
    if (!confirm(`Delete query scope ${host}${pathPrefix} entirely? All learned classifications and pins for this scope will be removed.`)) return;
    try {
      await dispatch(`qdelete:${scopeKey}`, { action: 'query-delete', host, pathPrefix });
      setResult({ ok: true, message: `Deleted query scope ${host}${pathPrefix}.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onPathDelete = async (zoneKey: string) => {
    const { host, pathPrefix } = splitKey(zoneKey);
    if (!confirm(`Delete path zone ${host}${pathPrefix} entirely? Its learned verdict and any pin will be removed.`)) return;
    try {
      await dispatch(`pdelete:${zoneKey}`, { action: 'path-delete', host, pathPrefix });
      setResult({ ok: true, message: `Deleted path zone ${host}${pathPrefix}.` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onResetAll = async () => {
    if (!confirm('Reset all learned query and path denoiser state? Pins will be cleared.')) return;
    try {
      await dispatch('reset-all', { action: 'reset-all' });
      setResult({ ok: true, message: 'All learned denoiser state has been reset.' });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const onExportWaf = async () => {
    try {
      const data = (await dispatch('waf-export', { action: 'waf-export' })) as WafExportResponse;
      setWaf(data);
      setResult({ ok: true, message: `WAF export ready — ${data.queryNoiseParams?.length ?? 0} noise param(s), ${data.deadZones?.length ?? 0} dead zone(s).` });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed' });
    }
  };

  const q = report?.queryDenoiser;
  const p = report?.pathDenoiser;

  return (
    <>
      <PageHead
        title="Denoisers"
        sub="What Trident has learned: which query parameters are cache-key noise vs. signal, and which path zones are dead, alive, or still learning."
        actions={
          <>
            <button className="btn btn-secondary" onClick={onExportWaf} disabled={busy != null}>
              <Icon name="download" size={14} /> {busy === 'waf-export' ? 'Exporting…' : 'Export WAF'}
            </button>
            <button className="btn btn-danger" onClick={onResetAll} disabled={busy != null}>
              <Icon name="trash" size={14} /> {busy === 'reset-all' ? 'Resetting…' : 'Reset all'}
            </button>
          </>
        }
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot reach denoiser API: {loadErr}
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <StatCard
          label="Query denoiser"
          value={<Badge variant={q?.enabled ? 'success' : 'default'} dot>{q?.enabled ? 'enabled' : 'disabled'}</Badge>}
          hint={q ? `${q.scopes} scope${q.scopes === 1 ? '' : 's'}` : '—'}
        />
        <StatCard label="Noise params" value={q ? formatNumber(q.paramsNoise) : '—'} hint="learned as noise" />
        <StatCard label="Signal params" value={q ? formatNumber(q.paramsSignal) : '—'} hint="kept in cache key" />
        <StatCard
          label="Path zones"
          value={<Badge variant={p?.enabled ? 'success' : 'default'} dot>{p?.enabled ? 'enabled' : 'disabled'}</Badge>}
          hint={p ? `${p.zonesDead} dead · ${p.zonesAlive} alive · ${p.zonesLearning} learning` : '—'}
        />
      </div>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>
          Query scopes <span className="count">{scopes.length}</span>
        </button>
        <button className={tab === 'path' ? 'active' : ''} onClick={() => setTab('path')}>
          Path zones <span className="count">{zones.length}</span>
        </button>
      </div>

      {tab === 'query' ? (
        <Card
          title={<><Icon name="denoise" size={14} /> Query denoiser scopes</>}
          sub="Per host/path-prefix scope: parameters classified as noise (stripped from the cache key) or signal (preserved). Pin to lock a classification; unpin to let learning resume."
          padded={false}
        >
          {scopes.length === 0 ? (
            <div style={{ padding: 16 }}>
              <p className="text-muted" style={{ margin: 0 }}>No query scopes learned yet. Trident populates these as traffic flows through cacheable endpoints.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Classification</th>
                    <th>Parameter</th>
                    <th className="tnum" style={{ textAlign: 'right' }}>Samples</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scopes.flatMap((scope) => {
                    const rows: { cls: 'noise' | 'signal'; param: string }[] = [
                      ...scope.noise.map((param) => ({ cls: 'noise' as const, param })),
                      ...scope.signal.map((param) => ({ cls: 'signal' as const, param })),
                    ];
                    if (rows.length === 0) {
                      return [
                        <tr key={scope.scopeKey}>
                          <td className="mono">{scope.scopeKey}</td>
                          <td colSpan={3} className="text-subtle">no classified params</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => onQueryDelete(scope.scopeKey)}
                              disabled={busy != null}
                              title={`Delete scope ${scope.scopeKey} entirely`}
                            >
                              <Icon name="trash" size={14} /> {busy === `qdelete:${scope.scopeKey}` ? 'Deleting…' : 'Delete'}
                            </button>
                          </td>
                        </tr>,
                      ];
                    }
                    return rows.map((r, idx) => {
                      const flip = r.cls === 'noise' ? 'signal' : 'noise';
                      const pinKey = `qpin:${scope.scopeKey}:${r.param}`;
                      const unpinKey = `qunpin:${scope.scopeKey}:${r.param}`;
                      const deleteKey = `qdelete:${scope.scopeKey}`;
                      return (
                        <tr key={`${scope.scopeKey}:${r.cls}:${r.param}`}>
                          <td className="mono">{idx === 0 ? scope.scopeKey : ''}</td>
                          <td>
                            <Badge variant={r.cls === 'noise' ? 'warn' : 'accent'}>{r.cls}</Badge>
                          </td>
                          <td className="mono">{r.param}</td>
                          <td className="tnum" style={{ textAlign: 'right' }}>{(scope.noise.length + scope.signal.length)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => onQueryPin(r.param, flip, scope.scopeKey)}
                              disabled={busy != null}
                              title={`Pin "${r.param}" as ${flip}`}
                            >
                              Pin {flip}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => onQueryUnpin(r.param, scope.scopeKey)}
                              disabled={busy != null}
                            >
                              {busy === unpinKey ? 'Unpinning…' : 'Unpin'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => onQueryPin(r.param, r.cls, scope.scopeKey)}
                              disabled={busy != null}
                              title={`Pin "${r.param}" as ${r.cls}`}
                            >
                              {busy === pinKey ? '…' : `Pin ${r.cls}`}
                            </button>
                            {idx === 0 && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => onQueryDelete(scope.scopeKey)}
                                disabled={busy != null}
                                title={`Delete scope ${scope.scopeKey} entirely`}
                              >
                                <Icon name="trash" size={14} /> {busy === deleteKey ? 'Deleting…' : 'Delete'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card
          title={<><Icon name="denoise" size={14} /> Path denoiser zones</>}
          sub="Per host/path-prefix zone: dead (never cacheable — short-circuited), alive (serves from cache), or learning. Pin to lock a verdict; unpin to resume learning."
          padded={false}
        >
          {zones.length === 0 ? (
            <div style={{ padding: 16 }}>
              <p className="text-muted" style={{ margin: 0 }}>No path zones learned yet. Zones appear as Trident observes traffic per path prefix.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 0, boxShadow: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Decision</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => {
                    const unpinKey = `punpin:${zone.zoneKey}`;
                    const deleteKey = `pdelete:${zone.zoneKey}`;
                    return (
                      <tr key={zone.zoneKey}>
                        <td className="mono">{zone.zoneKey}</td>
                        <td><Badge variant={statusVariant(zone.status)} dot>{zone.status}</Badge></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onPathPin(zone.zoneKey, 'alive')}
                            disabled={busy != null || zone.status === 'alive'}
                          >
                            Pin alive
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onPathPin(zone.zoneKey, 'dead')}
                            disabled={busy != null || zone.status === 'dead'}
                          >
                            Pin dead
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onPathUnpin(zone.zoneKey)}
                            disabled={busy != null}
                          >
                            {busy === unpinKey ? 'Unpinning…' : 'Unpin'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onPathDelete(zone.zoneKey)}
                            disabled={busy != null}
                            title={`Delete zone ${zone.zoneKey} entirely`}
                          >
                            <Icon name="trash" size={14} /> {busy === deleteKey ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {(q || p) && (
        <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
          <Card title={<><Icon name="filter" size={14} /> Top noise / signal</>} sub="Most-seen parameters across all query scopes.">
            <div className="grid-2">
              <div>
                <div className="label-text">Top noise (stripped)</div>
                {q && q.topNoise.length > 0 ? (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {q.topNoise.map((n) => <span key={n} className="mono"><Badge variant="warn">{n}</Badge></span>)}
                  </div>
                ) : <p className="text-subtle" style={{ margin: 0, fontSize: 13 }}>none yet</p>}
              </div>
              <div>
                <div className="label-text">Top signal (kept)</div>
                {q && q.topSignal.length > 0 ? (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {q.topSignal.map((n) => <span key={n} className="mono"><Badge variant="accent">{n}</Badge></span>)}
                  </div>
                ) : <p className="text-subtle" style={{ margin: 0, fontSize: 13 }}>none yet</p>}
              </div>
            </div>
          </Card>

          <Card title={<><Icon name="download" size={14} /> WAF export</>} sub="Translate learned denoiser knowledge into WAF rules.">
            {waf ? (
              <>
                <div className="row" style={{ gap: 24, marginBottom: 12, fontSize: 13 }}>
                  <span><strong className="tnum">{waf.queryNoiseParams.length}</strong> <span className="text-subtle">noise params</span></span>
                  <span><strong className="tnum">{waf.deadZones.length}</strong> <span className="text-subtle">dead zones</span></span>
                  <span className="text-subtle mono">{waf.format}</span>
                </div>
                <pre className="mono" style={{ margin: 0, padding: 12, background: 'var(--surface-2)', borderRadius: 6, fontSize: 12, overflowX: 'auto', maxHeight: 240 }}>
{JSON.stringify({ queryNoiseParams: waf.queryNoiseParams, deadZones: waf.deadZones }, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>Click <strong>Export WAF</strong> to generate rules from the current learned state.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
