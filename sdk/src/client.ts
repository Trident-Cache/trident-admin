/**
 * Trident Cache SDK - Admin Client
 *
 * @package @trident-cache/sdk
 */

import { normalizePurgeResponse } from './purge-response';
import type {
  TridentConfig,
  PurgeByUrlOptions,
  PurgeByUrlsOptions,
  PurgeByTagOptions,
  PurgeByTagsOptions,
  PurgeByPatternOptions,
  PurgeByTagPatternOptions,
  PurgeByHostOptions,
  PurgeByVaryOptions,
  PurgeByHashOptions,
  PurgeResponse,
  PurgePreviewResponse,
  HealthResponse,
  ReadyResponse,
  CacheStatsResponse,
  CacheCoverageOptions,
  CacheCoverageResponse,
  TopUrlsResponse,
  TagStatsResponse,
  RefreshQueueResponse,
  LatencyStatsResponse,
  ErrorStatsResponse,
  BackendsResponse,
  BackendDetailResponse,
  BackendActionResponse,
  BansResponse,
  BanCreateResponse,
  ReloadResponse,
  ConfigResponse,
  RulesResponse,
  RulesValidateResponse,
  LaunchStartOptions,
  LaunchResponse,
  LaunchStatusResponse,
  WarmerStatusResponse,
  WarmerQueueResponse,
  WarmerRunResponse,
  WarmerCancelResponse,
  ReflectEnableOptions,
  ReflectStatusResponse,
  ReflectDisableResponse,
  ReflectQueueResponse,
  CacheEntriesResponse,
  CacheEntryResponse,
  CacheTagsResponse,
  ProtectionStatsResponse,
  MemorySnapshotResponse,
  MemoryCollectResponse,
  ConnectionsResponse,
  SnapshotResponse,
  DiscoveryListResponse,
  DiscoveryDetailResponse,
  DiscoveryRefreshResponse,
  DenoiserReportResponse,
  QueryScopeDetail,
  PathZoneDetail,
  QueryPinOptions,
  QueryUnpinOptions,
  PathPinOptions,
  PathUnpinOptions,
  PathDeleteZoneOptions,
  QueryDeleteScopeOptions,
  DenoiserDeleteResponse,
  WafExportResponse,
  TridentEvent,
  EventCallback,
  // Legacy types for backwards compatibility
  StatsResponse,
  RefreshQueueStats,
  DiscoveryResponse,
  // Observability (1.5.0)
  StatusResponse,
  ExplainRequest,
  ExplainResponse,
} from './types';

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ])
    );
  }
  return obj;
}

export class TridentError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'TridentError';
  }
}

export class TridentClient {
  private readonly adminUrl: string;
  private readonly authToken?: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: TridentConfig) {
    this.adminUrl = config.adminUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authToken = config.authToken;
    this.timeout = config.timeout ?? 5000;
    this.fetchFn = config.fetch ?? fetch;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private async purgeRequest(path: string, body: unknown): Promise<PurgeResponse> {
    return normalizePurgeResponse(await this.request<unknown>('POST', path, body));
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.adminUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new TridentError(
          `Trident API error: ${response.status} ${response.statusText}`,
          response.status,
          text
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const json = await response.json();
        return transformKeys(json) as T;
      }

      return response.text() as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TridentError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TridentError('Request timeout');
      }
      throw new TridentError(`Network error: ${error}`);
    }
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  /**
   * Check if Trident server is healthy
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/admin/health');
  }

  /**
   * Check if Trident is ready (backends healthy)
   */
  async ready(): Promise<ReadyResponse> {
    return this.request<ReadyResponse>('GET', '/admin/ready');
  }

  /**
   * License / degraded-mode status (Trident 1.5.0).
   *
   * `mode` is `"degraded"` when the license check fails and Trident runs in
   * pass-through (no caching), `"licensed"` when caching is active, or
   * `"unknown"` when no license manager is available.
   */
  async status(): Promise<StatusResponse> {
    return this.request<StatusResponse>('GET', '/admin/status');
  }

  /**
   * Dry-run cacheability (Trident 1.5.0): explain whether a hypothetical
   * request would `hit`, `miss`, or `pass` — and why. Read-only; never mutates
   * the cache, telemetry, or denoiser state. Pass `detail: true` to also get the
   * resolved cache key, any existing entry's metadata, and denoiser classification.
   */
  async explain(request: ExplainRequest): Promise<ExplainResponse> {
    return this.request<ExplainResponse>('POST', '/admin/explain', {
      method: request.method,
      url: request.url,
      headers: request.headers ?? {},
      detail: request.detail ?? false,
    });
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStatsResponse> {
    return this.request<CacheStatsResponse>('GET', '/admin/stats');
  }

  /**
   * Get top URLs by requests, bytes, etc.
   */
  async topUrls(limit = 20, sort = 'requests'): Promise<TopUrlsResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('sort', sort);
    return this.request<TopUrlsResponse>('GET', `/admin/stats/top?${params}`);
  }

  /**
   * Get tag statistics
   */
  async tagStats(): Promise<TagStatsResponse> {
    return this.request<TagStatsResponse>('GET', '/admin/tags/stats');
  }

  /**
   * Get refresh queue status
   */
  async refreshQueue(): Promise<RefreshQueueResponse> {
    return this.request<RefreshQueueResponse>('GET', '/admin/refresh/queue');
  }

  /**
   * Get latency statistics (percentiles)
   */
  async latencyStats(): Promise<LatencyStatsResponse> {
    return this.request<LatencyStatsResponse>('GET', '/admin/stats/latency');
  }

  /**
   * Get error statistics
   */
  async errorStats(limit = 10): Promise<ErrorStatsResponse> {
    return this.request<ErrorStatsResponse>('GET', `/admin/stats/errors?limit=${limit}`);
  }

  // ===========================================================================
  // Backend Management
  // ===========================================================================

  /**
   * Get backend health status
   */
  async backends(): Promise<BackendsResponse> {
    return this.request<BackendsResponse>('GET', '/admin/backends');
  }

  /**
   * Get detailed backend information
   */
  async backendDetail(name: string): Promise<BackendDetailResponse> {
    return this.request<BackendDetailResponse>(
      'GET',
      `/admin/backends/detail?name=${encodeURIComponent(name)}`
    );
  }

  /**
   * Drain a backend (stop sending new requests)
   */
  async drainBackend(name: string): Promise<BackendActionResponse> {
    return this.request<BackendActionResponse>('POST', '/admin/backends/drain', {
      name,
    });
  }

  /**
   * Restore a drained backend
   */
  async restoreBackend(name: string): Promise<BackendActionResponse> {
    return this.request<BackendActionResponse>('POST', '/admin/backends/restore', {
      name,
    });
  }

  // ===========================================================================
  // Banning
  // ===========================================================================

  /**
   * Get active bans/soft-purges
   */
  async bans(limit = 100): Promise<BansResponse> {
    return this.request<BansResponse>('GET', `/admin/bans?limit=${limit}`);
  }

  /**
   * Get a specific ban by ID
   */
  async ban(id: string): Promise<BansResponse> {
    return this.request<BansResponse>('GET', `/admin/bans/${encodeURIComponent(id)}`);
  }

  /**
   * Create a ban rule
   */
  async createBan(pattern: string, type: 'url' | 'tag' | 'host' = 'url'): Promise<BanCreateResponse> {
    return this.request<BanCreateResponse>('POST', '/admin/bans', {
      type,
      pattern,
    });
  }

  /**
   * Delete a ban by ID
   */
  async deleteBan(id: string): Promise<boolean> {
    try {
      await this.request<unknown>('DELETE', `/admin/bans/${encodeURIComponent(id)}`);
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Hot reload configuration
   */
  async reload(): Promise<ReloadResponse> {
    return this.request<ReloadResponse>('POST', '/admin/config/reload');
  }

  /**
   * Get current configuration (sanitized)
   */
  async config(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>('GET', '/admin/config');
  }

  /**
   * Get active rules with statistics
   */
  async rules(): Promise<RulesResponse> {
    return this.request<RulesResponse>('GET', '/admin/rules');
  }

  /**
   * Validate current configuration file
   */
  async validateRules(): Promise<RulesValidateResponse> {
    return this.request<RulesValidateResponse>('POST', '/admin/rules/validate');
  }

  // ===========================================================================
  // Purge Operations
  // ===========================================================================

  /**
   * Purge a specific URL from the cache
   */
  async purgeUrl(options: PurgeByUrlOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = {
      url: options.url,
    };
    if (options.host) {
      body.host = options.host;
    }
    if (options.method) {
      body.method = options.method;
    }
    if (!options.soft) {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/url', body);
  }

  /**
   * Purge multiple URLs
   */
  async purgeUrls(options: PurgeByUrlsOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = {
      urls: options.urls,
    };
    if (!options.soft) {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/urls', body);
  }

  /**
   * Purge cache entries matching a URL regex pattern
   */
  async purgeUrlPattern(options: PurgeByPatternOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = {
      pattern: options.pattern,
    };
    if (!options.soft) {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/pattern', body);
  }

  /**
   * Purge cache by single tag
   */
  async purgeTag(options: PurgeByTagOptions): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/purge/tag', {
      tag: options.tag,
    });
  }

  /**
   * Purge cache by multiple tags (OR match by default)
   */
  async purgeTags(options: PurgeByTagsOptions): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/purge/tags', {
      tags: options.tags,
      match_mode: options.matchMode ?? 'any',
    });
  }

  /**
   * Purge cache by multiple tags with AND match (all tags must match)
   */
  async purgeTagsAll(tags: string[]): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/purge/tags', {
      tags,
      match_mode: 'all',
    });
  }

  /**
   * Purge cache by tag pattern (wildcard or regex)
   */
  async purgeTagPattern(options: PurgeByTagPatternOptions): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/purge/tag/pattern', {
      pattern: options.pattern,
      // The engine reads `pattern_type`; `type` was ignored, so a regex purge ran as a wildcard.
      pattern_type: options.patternType ?? 'wildcard',
    });
  }

  /**
   * Purge all entries from the cache
   */
  async purgeAll(): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/cache/clear', {
      confirm: true,
    });
  }

  /**
   * Purge cache entry by hash
   */
  async purgeHash(options: PurgeByHashOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = {
      hash: options.hash,
    };
    if (!options.soft) {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/hash', body);
  }

  /**
   * Preview purge operation (dry-run)
   */
  async purgePreview(pattern: string, type: 'url' | 'tag' = 'url'): Promise<PurgePreviewResponse> {
    return this.request<PurgePreviewResponse>('POST', '/admin/purge/preview', {
      pattern,
      type,
      dry_run: true,
    });
  }

  /**
   * Purge all cached entries for a host (native /admin/purge/host endpoint, 1.0.5+).
   */
  async purgeHost(options: PurgeByHostOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = { host: options.host };
    if (options.soft) {
      body.mode = 'soft';
    } else {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/host', body);
  }

  /**
   * Purge entries by Vary dimension (e.g. customer group, store) — 1.0.5+.
   */
  async purgeVary(options: PurgeByVaryOptions): Promise<PurgeResponse> {
    const body: Record<string, unknown> = {
      header: options.header,
      value: options.value,
    };
    if (options.soft) {
      body.mode = 'soft';
    } else {
      body.mode = 'hard';
    }
    return this.purgeRequest('/admin/purge/vary', body);
  }

  // ===========================================================================
  // Launch Mode (Enterprise)
  // ===========================================================================

  /**
   * Start the singleton launch with explicit URLs. Omitted controls are left
   * absent so the server can apply its configuration; explicit false is retained.
   */
  async launchStart(options: LaunchStartOptions): Promise<LaunchResponse> {
    if (!options || !Array.isArray(options.urls)) {
      throw new TypeError('Launch requires an explicit urls array');
    }
    const supported = ['urls', 'maintenance', 'autoComplete', 'bypassIps', 'bypassPaths'];
    for (const field of Object.keys(options)) {
      if (!supported.includes(field)) {
        throw new TypeError(`Unsupported Launch option: ${field}`);
      }
    }

    const body: Record<string, unknown> = {
      urls: options.urls,
      auto_complete: options.autoComplete,
      bypass_ips: options.bypassIps,
      bypass_paths: options.bypassPaths,
    };
    if (options.maintenance !== undefined) {
      const maintenance = options.maintenance;
      if (maintenance === null || typeof maintenance !== 'object' || Array.isArray(maintenance)) {
        throw new TypeError('Launch maintenance must be an object');
      }
      const supportedMaintenance = ['title', 'message', 'statusCode', 'retryAfter'];
      for (const field of Object.keys(maintenance)) {
        if (!supportedMaintenance.includes(field)) {
          throw new TypeError(`Unsupported Launch maintenance option: ${field}`);
        }
      }
      body.maintenance = {
        title: maintenance.title,
        message: maintenance.message,
        status_code: maintenance.statusCode,
        retry_after: maintenance.retryAfter,
      };
    }

    return this.request<LaunchResponse>('POST', '/admin/launch/start', body);
  }

  /**
   * Get launch status. Launch is a singleton — no id. Returns 200 with
   * `{ active:false, state:"disabled" }` when launch mode is not enabled.
   */
  async launchStatus(): Promise<LaunchStatusResponse> {
    return this.request<LaunchStatusResponse>('GET', '/admin/launch/status');
  }

  /**
   * Complete the active launch (clear maintenance, go live).
   */
  async launchComplete(): Promise<LaunchResponse> {
    return this.request<LaunchResponse>('POST', '/admin/launch/complete');
  }

  /**
   * Abort the active launch.
   */
  async launchAbort(reason?: string): Promise<LaunchResponse> {
    return this.request<LaunchResponse>(
      'POST',
      '/admin/launch/abort',
      reason ? { reason } : undefined
    );
  }

  // ===========================================================================
  // Cache Warmer  (/admin/warmer/*)
  // ===========================================================================

  /**
   * Current warmer status: enabled flag, state, schedule, in-flight run
   * progress, and the last completed run summary.
   */
  async warmerStatus(): Promise<WarmerStatusResponse> {
    return this.request<WarmerStatusResponse>('GET', '/admin/warmer/status');
  }

  /**
   * Queue an explicit list of URLs to warm. Empty list is accepted.
   * Returns `409 LAUNCH_ACTIVE` while launch mode is on, `404 WARMER_DISABLED`
   * when the warmer is not enabled.
   */
  async warmerQueue(urls: string[]): Promise<WarmerQueueResponse> {
    return this.request<WarmerQueueResponse>('POST', '/admin/warmer/queue', { urls });
  }

  /**
   * Start a warming run now. Without options it warms the configured
   * sitemap/static sources; given sitemaps (`.xml` or `.xml.gz`, an index
   * expands) and/or URLs it warms those instead (Trident 1.8.0+).
   */
  async warmerRun(opts: { sitemaps?: string[]; urls?: string[] } = {}): Promise<WarmerRunResponse> {
    const clean = (l?: string[]) => (l ?? []).map((u) => u.trim()).filter((u) => u !== '');
    const sitemaps = clean(opts.sitemaps);
    const urls = clean(opts.urls);
    if (sitemaps.length === 0 && urls.length === 0) {
      return this.request<WarmerRunResponse>('POST', '/admin/warmer/run');
    }
    return this.request<WarmerRunResponse>('POST', '/admin/warmer/run', {
      ...(sitemaps.length ? { sitemaps } : {}),
      ...(urls.length ? { urls } : {}),
    });
  }

  /**
   * Cancel/drain the current warm run.
   */
  async warmerCancel(): Promise<WarmerCancelResponse> {
    return this.request<WarmerCancelResponse>('POST', '/admin/warmer/cancel');
  }

  // ===========================================================================
  // Reflect Mode  (/admin/reflect/*) — emergency origin shield
  // ===========================================================================

  /** Current reflect status: active flag, level, queued-purge count, reason. */
  async reflectStatus(): Promise<ReflectStatusResponse> {
    return this.request<ReflectStatusResponse>('GET', '/admin/reflect/status');
  }

  /** Enable reflect mode (origin shield). Purges are queued while active. */
  async reflectEnable(options: ReflectEnableOptions = {}): Promise<ReflectStatusResponse> {
    return this.request<ReflectStatusResponse>('POST', '/admin/reflect/enable', options);
  }

  /** Disable reflect. `replay` re-runs the queued purges as hard purges; `hard` soft-purges them (marks stale for lazy revalidation). Neither discards the queue. */
  async reflectDisable(mode: 'replay' | 'hard' = 'replay'): Promise<ReflectDisableResponse> {
    return this.request<ReflectDisableResponse>('POST', '/admin/reflect/disable', { mode });
  }

  /** List the purges deferred while reflect is active. */
  async reflectQueue(): Promise<ReflectQueueResponse> {
    return this.request<ReflectQueueResponse>('GET', '/admin/reflect/queue');
  }

  // ===========================================================================
  // Cache Browsing
  // ===========================================================================

  /**
   * List cache entries with pagination
   */
  async cacheEntries(limit = 100, offset = 0, filter?: string): Promise<CacheEntriesResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (filter) {
      params.set('filter', filter);
    }
    return this.request<CacheEntriesResponse>('GET', `/admin/cache/entries?${params}`);
  }

  /**
   * Get cache entry by URL.
   * Pass `includeBody` to receive the cached response body as base64 (max 10 MB).
   * `scheme` selects between http/https variants (trident keys them separately); defaults to https.
   */
  async cacheEntry(
    url: string,
    host?: string,
    method = 'GET',
    includeBody = false,
    scheme?: 'http' | 'https',
  ): Promise<CacheEntryResponse> {
    const params = new URLSearchParams();
    params.set('url', url);
    params.set('method', method);
    if (host) {
      params.set('host', host);
    }
    if (scheme) {
      params.set('scheme', scheme);
    }
    if (includeBody) {
      params.set('include_body', 'true');
    }
    return this.request<CacheEntryResponse>('GET', `/admin/cache/entry?${params}`);
  }

  /**
   * Cache coverage for a set of URLs.
   *
   * Returns, per URL, whether it is currently cached (with freshness/age/ttl/
   * size) plus an aggregate cached percentage — one round-trip instead of N
   * `cacheEntry()` calls. Useful for measuring warm coverage of a URL list.
   */
  async cacheCoverage(
    urls: string[],
    options: CacheCoverageOptions = {},
  ): Promise<CacheCoverageResponse> {
    return this.request<CacheCoverageResponse>('POST', '/admin/cache/coverage', {
      urls,
      ...options,
    });
  }

  /**
   * List cache tags with pagination
   */
  async cacheTags(limit = 100, offset = 0, filter?: string): Promise<CacheTagsResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (filter) {
      params.set('filter', filter);
    }
    return this.request<CacheTagsResponse>('GET', `/admin/cache/tags?${params}`);
  }

  // ===========================================================================
  // Advanced Statistics
  // ===========================================================================

  /**
   * Get backend protection/circuit breaker statistics
   */
  async protectionStats(): Promise<ProtectionStatsResponse> {
    return this.request<ProtectionStatsResponse>('GET', '/admin/stats/protection');
  }

  /**
   * Get the detailed memory accounting snapshot (BP-59): per-category byte
   * totals, the allocator band (RSS, committed), tracked vs untracked bytes,
   * and per-entry footprint percentiles.
   */
  async memoryStats(): Promise<MemorySnapshotResponse> {
    return this.request<MemorySnapshotResponse>('GET', '/admin/memory');
  }

  /**
   * Force an allocator collect cycle and return memory snapshots taken
   * immediately before and after, so callers can measure pages reclaimed.
   */
  async memoryCollect(): Promise<MemoryCollectResponse> {
    return this.request<MemoryCollectResponse>('POST', '/admin/memory/collect');
  }

  /**
   * Get backend connection pool statistics
   */
  async connections(): Promise<ConnectionsResponse> {
    return this.request<ConnectionsResponse>('GET', '/admin/connections');
  }

  // ===========================================================================
  // Cache Persistence
  // ===========================================================================

  /**
   * Create a cache snapshot for persistence
   */
  async snapshot(path?: string): Promise<SnapshotResponse> {
    const body = path ? { path } : undefined;
    const response = await this.request<SnapshotResponse>('POST', '/admin/snapshot', body);
    return {
      ...response,
      // Preserve existing SDK accessors while reading the actual wire schema.
      entriesCount: response.entryCount ?? response.entriesCount,
      sizeBytes: response.fileSize ?? response.sizeBytes,
      duration: response.durationMs ?? response.duration,
    };
  }

  // ===========================================================================
  // DNS Discovery
  // ===========================================================================

  /**
   * List DNS discovery backends
   */
  async discoveryList(): Promise<DiscoveryListResponse> {
    return this.request<DiscoveryListResponse>('GET', '/admin/discovery');
  }

  /**
   * Get detailed DNS discovery information for a backend
   */
  async discoveryDetail(name: string): Promise<DiscoveryDetailResponse> {
    return this.request<DiscoveryDetailResponse>(
      'GET',
      `/admin/discovery/detail?${new URLSearchParams({ name })}`
    );
  }

  /**
   * Force DNS refresh for a backend
   */
  async discoveryRefresh(name: string): Promise<DiscoveryRefreshResponse> {
    return this.request<DiscoveryRefreshResponse>(
      'POST',
      `/admin/discovery/refresh?${new URLSearchParams({ name })}`
    );
  }

  // ===========================================================================
  // Denoisers (1.2.0)
  // ===========================================================================

  /**
   * Combined denoiser report (paths + queries).
   */
  async denoiserReport(): Promise<DenoiserReportResponse> {
    return this.request<DenoiserReportResponse>('GET', '/admin/denoisers/report');
  }

  /**
   * List learned QueryDenoiser scopes.
   */
  async denoiserQueryScopes(): Promise<QueryScopeDetail[]> {
    return this.request<QueryScopeDetail[]>('GET', '/admin/denoisers/query/scopes');
  }

  /**
   * List learned PathDenoiser zones.
   */
  async denoiserPathZones(): Promise<PathZoneDetail[]> {
    return this.request<PathZoneDetail[]>('GET', '/admin/denoisers/path/zones');
  }

  /**
   * Operator pin a query parameter classification.
   */
  async denoiserQueryPin(options: QueryPinOptions): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/query/pin', {
      param: options.param,
      class: options.class,
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Operator unpin a query parameter.
   */
  async denoiserQueryUnpin(options: QueryUnpinOptions): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/query/unpin', {
      param: options.param,
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Operator pin a path zone status.
   */
  async denoiserPathPin(options: PathPinOptions): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/path/pin', {
      status: options.status,
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Operator unpin a path zone.
   */
  async denoiserPathUnpin(options: PathUnpinOptions): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/path/unpin', {
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Delete a single PathDenoiser zone entirely (scoped to one host/path
   * prefix). Use this to clear a malformed pin without resetting every
   * learned zone via denoiserPathReset(). Returns `{ deleted: true }` when a
   * zone was removed, `{ deleted: false }` (HTTP 404) when it was not present.
   */
  async denoiserPathDeleteZone(
    options: PathDeleteZoneOptions = {}
  ): Promise<DenoiserDeleteResponse> {
    return this.request<DenoiserDeleteResponse>('DELETE', '/admin/denoisers/path/zone', {
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Delete a single QueryDenoiser scope entirely (scoped to one host/path
   * prefix). Symmetric companion to denoiserPathDeleteZone(): clear one bad
   * scope without dropping every learned classification via
   * denoiserQueryReset(). Returns `{ deleted: true }` when a scope was
   * removed, `{ deleted: false }` (HTTP 404) when it was not present.
   */
  async denoiserQueryDeleteScope(
    options: QueryDeleteScopeOptions = {}
  ): Promise<DenoiserDeleteResponse> {
    return this.request<DenoiserDeleteResponse>('DELETE', '/admin/denoisers/query/scope', {
      host: options.host ?? '*',
      path_prefix: options.pathPrefix ?? '/',
    });
  }

  /**
   * Reset learned QueryDenoiser state.
   */
  async denoiserQueryReset(): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/query/reset');
  }

  /**
   * Reset learned PathDenoiser state.
   */
  async denoiserPathReset(): Promise<unknown> {
    return this.request<unknown>('POST', '/admin/denoisers/path/reset');
  }

  /**
   * Export denoiser knowledge as WAF rules.
   */
  async denoiserWafExport(): Promise<WafExportResponse> {
    return this.request<WafExportResponse>('GET', '/admin/denoisers/export/waf');
  }

  // ===========================================================================
  // Server-Sent Events (SSE)
  // ===========================================================================

  /**
   * Subscribe to real-time events via SSE
   * Returns an EventSource-like interface for handling events
   */
  events(callback: EventCallback): { close: () => void } {
    const url = `${this.adminUrl}/admin/events`;
    const headers: Record<string, string> = {};

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Use native EventSource if available (browser)
    if (typeof EventSource !== 'undefined') {
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TridentEvent;
          callback(data);
        } catch {
          // Ignore parse errors
        }
      };

      return {
        close: () => eventSource.close(),
      };
    }

    // For Node.js, use fetch with streaming (requires polyfill or node 18+)
    const controller = new AbortController();

    (async () => {
      try {
        const response = await this.fetchFn(url, {
          headers,
          signal: controller.signal,
        });

        if (!response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as TridentEvent;
                callback(data);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch {
        // Connection closed or error
      }
    })();

    return {
      close: () => controller.abort(),
    };
  }

  // ===========================================================================
  // Legacy Methods (backwards compatibility)
  // ===========================================================================

  /**
   * @deprecated Use stats() instead
   */
  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('GET', '/admin/stats');
  }

  /**
   * @deprecated Use refreshQueue() instead
   */
  async getRefreshQueueStats(): Promise<RefreshQueueStats> {
    return this.request<RefreshQueueStats>('GET', '/admin/refresh/queue');
  }

  /**
   * @deprecated Use topUrls() instead
   */
  async getDiscoveredUrls(limit?: number): Promise<DiscoveryResponse> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request<DiscoveryResponse>('GET', `/admin/discovery/urls${params}`);
  }

  /**
   * @deprecated Use cacheEntry() instead
   */
  async queryCache(url: string, host?: string): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('url', url);
    if (host) {
      params.set('host', host);
    }
    return this.request<unknown>('GET', `/admin/query?${params}`);
  }

  /**
   * @deprecated Use purgeAll() instead
   */
  async clearCache(): Promise<PurgeResponse> {
    return this.purgeAll();
  }

  /**
   * @deprecated Use backends() instead
   */
  async getBackends(): Promise<BackendsResponse> {
    return this.backends();
  }

  /**
   * @deprecated Use drainBackend() or restoreBackend() instead
   */
  async setBackendHealth(name: string, healthy: boolean): Promise<BackendActionResponse> {
    if (healthy) {
      return this.restoreBackend(name);
    }
    return this.drainBackend(name);
  }

  /**
   * @deprecated Use health() instead
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.health();
      return response.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * @deprecated Use ready() instead
   */
  async readyCheck(): Promise<boolean> {
    try {
      const response = await this.ready();
      return response.ready;
    } catch {
      return false;
    }
  }

  /**
   * @deprecated Use purgeTags() instead
   */
  async purgeByTags(options: { tags: string[] }): Promise<PurgeResponse> {
    return this.purgeTags({ tags: options.tags });
  }

  /**
   * @deprecated Use purgeUrlPattern() instead
   */
  async purgeByPattern(options: { pattern: string }): Promise<PurgeResponse> {
    return this.purgeUrlPattern({ pattern: options.pattern });
  }

  /**
   * @deprecated Use purgeAll() with host filter instead
   */
  async purgeByHost(options: { host: string }): Promise<PurgeResponse> {
    return this.purgeRequest('/admin/purge/host', {
      host: options.host,
    });
  }
}

/**
 * Create a new Trident client instance
 */
export function createClient(config: TridentConfig): TridentClient {
  return new TridentClient(config);
}
