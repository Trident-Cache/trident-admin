'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Card, Icon, PageHead, StatCard } from '@/components/ui/primitives';
import { apiUrl, formatNumber } from '@/lib/format';

// These response shapes exist in the SDK's internal types module but are not
// re-exported from the "@trident-cache/sdk" package barrel, so mirror them here
// to keep this screen self-contained and type-safe.
interface ConfigResponse {
  cache: Record<string, unknown>;
  backends: Record<string, unknown>;
  rules: Record<string, unknown>;
}

interface RuleInfo {
  name: string;
  pattern: string;
  priority: number;
  hits: number;
  action: string;
}

interface RulesResponse {
  rules: RuleInfo[];
  totalRules: number;
}

interface RulesValidateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type ConfigData = { config: ConfigResponse & Record<string, unknown>; rules: RulesResponse | null };
type Result = { ok: boolean; message: string } | null;

const KNOWN_GROUPS = ['server', 'cache', 'admin', 'backends'] as const;
const SECTION_ICON: Record<string, 'dashboard' | 'cache' | 'config' | 'backends'> = {
  server: 'dashboard',
  cache: 'cache',
  admin: 'config',
  backends: 'backends',
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function renderScalar(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-subtle">—</span>;
  if (typeof v === 'boolean') return <Badge variant={v ? 'success' : 'default'}>{v ? 'true' : 'false'}</Badge>;
  if (typeof v === 'number') return <span className="mono tnum">{v}</span>;
  if (typeof v === 'string') return <span className="mono">{v || <span className="text-subtle">""</span>}</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-subtle">[]</span>;
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return (
        <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {v.map((x, i) => <span key={i} className="chip mono">{String(x)}</span>)}
        </span>
      );
    }
  }
  return <span className="mono" style={{ fontSize: 12 }}>{JSON.stringify(v)}</span>;
}

/** Flatten a config section one level deep into displayable key/value rows. */
function sectionRows(value: unknown): { key: string; value: unknown }[] {
  if (isPlainObject(value)) return Object.entries(value).map(([key, v]) => ({ key, value: v }));
  return [{ key: '(value)', value }];
}

function ConfigSection({ name, value }: { name: string; value: unknown }) {
  const rows = sectionRows(value);
  const icon = SECTION_ICON[name] ?? 'config';
  return (
    <Card title={<><Icon name={icon} size={14} /> {name}</>} sub={`${rows.length} setting${rows.length === 1 ? '' : 's'}`}>
      {rows.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>No settings in this section.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <tbody>
              {rows.map(({ key, value: v }) => (
                <tr key={key}>
                  <td className="muted" style={{ whiteSpace: 'nowrap', verticalAlign: 'top', width: '40%' }}>{key}</td>
                  <td className="right" style={{ textAlign: 'left' }}>
                    {isPlainObject(v) ? (
                      <pre className="mono" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {JSON.stringify(v, null, 2)}
                      </pre>
                    ) : (
                      renderScalar(v)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function ConfigPage() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [validation, setValidation] = useState<RulesValidateResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/config/data'), { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `status ${res.status}`);
      setData(body);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'failed to load configuration');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onReload = async () => {
    setBusy('reload');
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/config/reload'), { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `request failed (${res.status})`);
      const warnings: string[] = body?.warnings ?? [];
      setResult({
        ok: true,
        message: (body?.message || 'Configuration reloaded from disk.') + (warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''),
      });
      await load();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed to reload' });
    } finally {
      setBusy(null);
    }
  };

  const onValidate = async () => {
    setBusy('validate');
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/config/validate'), { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `request failed (${res.status})`);
      setValidation(body);
      setResult({ ok: body.valid, message: body.valid ? 'Configuration is valid.' : `Configuration has ${body.errors?.length ?? 0} error(s).` });
    } catch (e) {
      setValidation(null);
      setResult({ ok: false, message: e instanceof Error ? e.message : 'failed to validate' });
    } finally {
      setBusy(null);
    }
  };

  const config = data?.config;
  const rulesList: RuleInfo[] = data?.rules?.rules ?? [];
  const totalRules = data?.rules?.totalRules ?? rulesList.length;

  // Split top-level config keys into known groups (rendered as sections) and the rest (raw JSON).
  const knownEntries = config ? KNOWN_GROUPS.filter((g) => config[g] !== undefined).map((g) => [g, config[g]] as const) : [];
  const otherEntries = config ? Object.entries(config).filter(([k]) => !KNOWN_GROUPS.includes(k as (typeof KNOWN_GROUPS)[number])) : [];
  const backendCount = config && Array.isArray(config.backends) ? config.backends.length
    : config && isPlainObject(config.backends) ? Object.keys(config.backends).length : null;

  return (
    <>
      <PageHead
        title="Configuration"
        sub="The live, sanitized configuration Trident is running — reload from disk and validate the rules file."
        actions={
          <>
            <button className="btn btn-secondary" onClick={onValidate} disabled={busy != null}>
              <Icon name="check" size={14} /> {busy === 'validate' ? 'Validating…' : 'Validate rules'}
            </button>
            <button className="btn btn-primary" onClick={onReload} disabled={busy != null}>
              <Icon name="refresh" size={14} /> {busy === 'reload' ? 'Reloading…' : 'Reload config'}
            </button>
          </>
        }
      />

      {loadErr && (
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>
          <Icon name="info" size={16} /> Cannot load configuration: {loadErr}. Make sure Trident is running.
        </div>
      )}

      {result && (
        <div className={`banner ${result.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 16 }}>
          <Icon name={result.ok ? 'check' : 'info'} size={16} /> {result.message}
        </div>
      )}

      {config && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            <StatCard label="Config sections" value={Object.keys(config).length} hint="top-level groups" />
            <StatCard label="Backends" value={backendCount ?? '—'} hint="configured origins" />
            <StatCard label="Active rules" value={totalRules} hint={`${rulesList.length} shown`} />
            <StatCard
              label="Validation"
              value={
                validation
                  ? <Badge variant={validation.valid ? 'success' : 'danger'} dot>{validation.valid ? 'valid' : 'invalid'}</Badge>
                  : <span className="text-subtle" style={{ fontSize: 14 }}>not run</span>
              }
              hint={validation ? `${validation.warnings?.length ?? 0} warning(s)` : 'run validate'}
            />
          </div>

          {validation && (validation.errors?.length || validation.warnings?.length) ? (
            <Card title={<><Icon name="check" size={14} /> Rules validation</>} sub="Result of validating the configuration file." className="col-span-3">
              {validation.errors?.length > 0 && (
                <div className="col" style={{ gap: 8, marginBottom: validation.warnings?.length ? 16 : 0 }}>
                  {validation.errors.map((err, i) => (
                    <div key={i} className="banner banner-danger" style={{ margin: 0 }}>
                      <Icon name="close" size={16} /> {err}
                    </div>
                  ))}
                </div>
              )}
              {validation.warnings?.length > 0 && (
                <div className="col" style={{ gap: 8 }}>
                  {validation.warnings.map((warn, i) => (
                    <div key={i} className="banner banner-warn" style={{ margin: 0 }}>
                      <Icon name="info" size={16} /> {warn}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {/* Grouped key config sections */}
          {knownEntries.length > 0 && (
            <div className="grid-2" style={{ alignItems: 'start', marginTop: 16 }}>
              {knownEntries.map(([name, value]) => (
                <ConfigSection key={name} name={name} value={value} />
              ))}
            </div>
          )}

          {/* Rules table */}
          <div style={{ marginTop: 16 }}>
            <Card title={<><Icon name="filter" size={14} /> Rules</>} sub={`${totalRules} active rule${totalRules === 1 ? '' : 's'} with match statistics.`}>
              {rulesList.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>No rules configured.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Pattern</th>
                        <th>Action</th>
                        <th className="right">Priority</th>
                        <th className="right">Hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesList.map((rule) => (
                        <tr key={rule.name}>
                          <td><strong>{rule.name}</strong></td>
                          <td><span className="mono" style={{ fontSize: 12.5 }}>{rule.pattern}</span></td>
                          <td><Badge variant="accent">{rule.action}</Badge></td>
                          <td className="right tnum">{rule.priority}</td>
                          <td className="right tnum">{formatNumber(rule.hits ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Other top-level config + raw JSON */}
          {otherEntries.length > 0 && (
            <div className="grid-2" style={{ alignItems: 'start', marginTop: 16 }}>
              {otherEntries.map(([name, value]) => (
                <ConfigSection key={name} name={name} value={value} />
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Card title={<><Icon name="config" size={14} /> Raw configuration (JSON)</>} sub="The complete sanitized config as returned by the admin API." padded={false}>
              <pre
                className="mono"
                style={{ margin: 0, padding: 16, fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre' }}
              >
                {JSON.stringify(config, null, 2)}
              </pre>
            </Card>
          </div>
        </>
      )}

      {!config && !loadErr && (
        <Card title={<><Icon name="config" size={14} /> Configuration</>}>
          <p className="text-muted" style={{ margin: 0 }}>Loading configuration…</p>
        </Card>
      )}
    </>
  );
}
