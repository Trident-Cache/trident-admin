import { createClient, type TridentConfig } from '@trident-cache/sdk';

const config: TridentConfig = {
  adminUrl: process.env.TRIDENT_ADMIN_URL || 'http://localhost:9303',
  authToken: process.env.TRIDENT_AUTH_TOKEN,
  timeout: 5000,
};

export const trident = createClient(config);

export { TridentError } from '@trident-cache/sdk';

/**
 * Fetch the full JSON metrics snapshot from the trident metrics server
 * (separate from the admin server — default port 9090, path /stats).
 *
 * Returns the raw `MetricsSnapshot` shape. Throws on network/HTTP errors.
 */
export async function fetchMetricsSnapshot(): Promise<MetricsSnapshot> {
  const base = process.env.TRIDENT_METRICS_URL || 'http://localhost:9090';
  const path = process.env.TRIDENT_METRICS_STATS_PATH || '/stats';
  const token = process.env.TRIDENT_METRICS_TOKEN;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`metrics server returned ${res.status}`);
    }
    return (await res.json()) as MetricsSnapshot;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * One sample from a Prometheus exposition. Labels are flattened.
 */
export interface PrometheusSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

/**
 * Fetch and parse the Prometheus text output from the metrics server.
 * Returns an empty array if the metrics server is unreachable.
 */
export async function fetchPrometheusSamples(): Promise<PrometheusSample[]> {
  const base = process.env.TRIDENT_METRICS_URL || 'http://localhost:9090';
  const path = process.env.TRIDENT_METRICS_PATH || '/metrics';
  const token = process.env.TRIDENT_METRICS_TOKEN;
  const headers: Record<string, string> = { Accept: 'text/plain' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal });
    if (!res.ok) return [];
    const text = await res.text();
    return parsePrometheusText(text);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function parsePrometheusText(text: string): PrometheusSample[] {
  const samples: PrometheusSample[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // metric_name{label="value",label2="value2"} 1234
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([0-9eE+\-.NaIninf]+)/);
    if (!match) continue;

    const [, name, labelStr, valueStr] = match;
    const value = Number(valueStr);
    if (!Number.isFinite(value)) continue;

    const labels: Record<string, string> = {};
    if (labelStr) {
      // label="value",foo="bar"
      const labelRe = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
      let lm: RegExpExecArray | null;
      while ((lm = labelRe.exec(labelStr)) !== null) {
        labels[lm[1]] = lm[2].replace(/\\(["\\n])/g, (_, c) => (c === 'n' ? '\n' : c));
      }
    }
    samples.push({ name, labels, value });
  }
  return samples;
}

/**
 * Sum all samples for a given metric name (across labels).
 */
export function sumByName(samples: PrometheusSample[], name: string): number {
  return samples.filter((s) => s.name === name).reduce((acc, s) => acc + s.value, 0);
}

/**
 * Group samples for a metric name by a single label, summing values.
 */
export function groupByLabel(
  samples: PrometheusSample[],
  name: string,
  label: string,
): Array<{ label: string; value: number }> {
  const grouped = new Map<string, number>();
  for (const s of samples) {
    if (s.name !== name) continue;
    const k = s.labels[label] ?? '';
    grouped.set(k, (grouped.get(k) ?? 0) + s.value);
  }
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Subset of fields from the Rust `MetricsSnapshot` we use in the admin UI.
 * The actual response is richer; we type only what we render.
 */
export interface MetricsSnapshot {
  cache?: {
    entries?: number;
    memory_used?: number;
    memory_max?: number;
    hits?: number;
    misses?: number;
    stale_hits?: number;
    hit_ratio?: number;
    stores?: number;
    deletes?: number;
    evictions?: number;
    evicted_bytes?: number;
    pass_mode_count?: number;
    soft_purges?: number;
    hard_purges?: number;
    bypass_method?: number;
    bypass_no_cache?: number;
    bypass_no_store?: number;
    bypass_pragma?: number;
    bypass_authorization?: number;
    bypass_cookie?: number;
    bypass_range?: number;
    bypass_pass_path?: number;
    bypass_query_param?: number;
    bypass_cookie_name?: number;
    compressed_entries?: number;
    compression_ratio?: number;
    compression_bytes_saved?: number;
  };
  memory?: {
    entry_body_bytes?: number;
    entry_header_bytes?: number;
    entry_key_bytes?: number;
    entry_overhead_bytes?: number;
    entry_total_bytes?: number;
    tag_index_bytes?: number;
    url_index_bytes?: number;
    shard_overhead_bytes?: number;
    tracked_total_bytes?: number;
    process_rss_bytes?: number;
    process_rss_peak_bytes?: number;
    untracked_bytes?: number;
    allocator?: {
      committed_bytes?: number;
      peak_committed_bytes?: number;
      page_faults?: number;
    };
  };
  uptime_seconds?: number;
  // Other top-level fields (tls, connection limits, etc.)
  // are accessed dynamically in pages that need them.
  [key: string]: unknown;
}
