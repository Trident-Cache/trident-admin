/**
 * Trident Cache SDK - TypeScript Types
 *
 * @package @trident-cache/sdk
 */

// =============================================================================
// Client Configuration
// =============================================================================

export interface TridentConfig {
  /** Base URL of the Trident admin API (e.g., 'http://localhost:9301') */
  adminUrl: string;
  /** Optional authentication token */
  authToken?: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Custom fetch implementation (for testing or SSR) */
  fetch?: typeof fetch;
}

// =============================================================================
// Cache Control Types
// =============================================================================

export type Cacheability = 'public' | 'private' | 'no-cache' | 'no-store';

export interface CacheControlOptions {
  /** Cache visibility: public, private, no-cache, or no-store */
  cacheability?: Cacheability;
  /** Max-age in seconds */
  maxAge?: number;
  /** S-maxage (shared cache max-age) in seconds */
  sMaxAge?: number;
  /** Stale-while-revalidate in seconds */
  staleWhileRevalidate?: number;
  /** Stale-if-error in seconds */
  staleIfError?: number;
  /** Must-revalidate directive */
  mustRevalidate?: boolean;
  /** Proxy-revalidate directive */
  proxyRevalidate?: boolean;
  /** Immutable directive */
  immutable?: boolean;
  /** No-transform directive */
  noTransform?: boolean;
}

export interface SurrogateControlOptions {
  /** Max-age in seconds */
  maxAge?: number;
  /** Stale-while-revalidate in seconds */
  staleWhileRevalidate?: number;
  /** Stale-if-error in seconds */
  staleIfError?: number;
  /** No-store directive */
  noStore?: boolean;
  /** Content types (e.g., 'text/html') */
  content?: string;
}

// =============================================================================
// Health & Status Types
// =============================================================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  uptimeSecs: number;
  version?: string;
}

export interface ReadyResponse {
  ready: boolean;
  backends: Record<string, boolean>;
}

export interface CacheStatsResponse {
  entries: number;
  hits: number;
  misses: number;
  memoryUsed: number;
  maxMemory: number;
  evictions: number;
  uptimeSecs: number;
}

export interface TopUrlEntry {
  url: string;
  host: string;
  hits: number;
  bytes: number;
  lastAccess: string;
}

export interface TopUrlsResponse {
  urls: TopUrlEntry[];
  total: number;
}

export interface TagStatsResponse {
  totalTags: number;
  totalEntries: number;
  avgEntriesPerTag: number;
  topTags: Array<{ tag: string; entries: number }>;
}

export interface RefreshQueueResponse {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface LatencyStatsResponse {
  latency: {
    p50Ms: number;
    p90Ms: number;
    p99Ms: number;
    avgMs: number;
    maxMs: number;
  };
  requestCount: number;
}

export interface ErrorEntry {
  url: string;
  statusCode: number;
  count: number;
  lastOccurred: string;
}

export interface ErrorStatsResponse {
  errors: ErrorEntry[];
  totalErrors: number;
}

// =============================================================================
// Purge Types
// =============================================================================

export interface PurgeByUrlOptions {
  /** URL path to purge (e.g., '/products/123') */
  url: string;
  /** Optional host header */
  host?: string;
  /** HTTP method (default: GET) */
  method?: string;
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeByUrlsOptions {
  /** URLs to purge */
  urls: string[];
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeByTagOptions {
  /** Single cache tag to purge */
  tag: string;
}

export interface PurgeByTagsOptions {
  /** Cache tags to purge */
  tags: string[];
  /** Match mode: 'any' (OR) or 'all' (AND) */
  matchMode?: 'any' | 'all';
}

export interface PurgeByPatternOptions {
  /** Regex pattern to match URLs */
  pattern: string;
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeByTagPatternOptions {
  /** Pattern to match tags */
  pattern: string;
  /** Pattern type: 'wildcard' or 'regex' */
  patternType?: 'wildcard' | 'regex';
}

export interface PurgeByHostOptions {
  /** Host to purge all entries for */
  host: string;
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeByVaryOptions {
  /** Vary dimension name (e.g., 'cookie:x-magento-vary' or 'accept-encoding') */
  header: string;
  /** Vary dimension value to match (e.g., 'group1' or 'gzip') */
  value: string;
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeByHashOptions {
  /** Cache entry hash to purge */
  hash: string;
  /** Soft purge (mark stale) instead of hard delete */
  soft?: boolean;
}

export interface PurgeResponse {
  /** The response confirms an applied purge/clear; a recorded Reflect purge is deferred. */
  success: boolean;
  /** Reported native count, including zero; retained independently of success. */
  purgedCount: number;
  message?: string;
}

export interface PurgePreviewResponse {
  wouldPurge: number;
  entries: Array<{
    url: string;
    host: string;
    tags: string[];
  }>;
}

// =============================================================================
// Backend Types
// =============================================================================

export interface BackendInfo {
  name: string;
  url: string;
  healthy: boolean;
  weight: number;
  drained: boolean;
}

export interface BackendsResponse {
  backends: BackendInfo[];
}

export interface BackendDetailResponse {
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

export interface BackendActionResponse {
  success: boolean;
  backend: string;
  action: string;
  message?: string;
}

// =============================================================================
// Ban Types
// =============================================================================

export interface BanInfo {
  id: string;
  pattern: string;
  type: 'url' | 'tag' | 'host';
  createdAt: string;
  expiresAt?: string;
}

export interface BansResponse {
  bans: BanInfo[];
  total: number;
}

export interface BanCreateResponse {
  success: boolean;
  id: string;
  message?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface ReloadResponse {
  success: boolean;
  message?: string;
  warnings?: string[];
}

export interface ConfigResponse {
  cache: Record<string, unknown>;
  backends: Record<string, unknown>;
  rules: Record<string, unknown>;
}

export interface RuleInfo {
  name: string;
  pattern: string;
  priority: number;
  hits: number;
  action: string;
}

export interface RulesResponse {
  rules: RuleInfo[];
  totalRules: number;
}

export interface RulesValidateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Launch Mode Types
// =============================================================================

/**
 * Controls for the singleton POST /admin/launch/start. The client serializes
 * these camelCase fields to the native snake_case wire schema. Named launches
 * and sitemap submission are not supported; provide an explicit URL array.
 */
export interface LaunchStartOptions {
  urls: string[];
  maintenance?: {
    title?: string;
    message?: string;
    statusCode?: number;
    retryAfter?: number;
  };
  /** Override the configured default for this run; omission leaves it to the server. */
  autoComplete?: boolean;
  bypassIps?: string[];
  bypassPaths?: string[];
}

export interface LaunchResponse {
  success: boolean;
  message?: string;
  totalUrls?: number;
  /** present on launchComplete() */
  urlsWarmed?: number;
  urlsFailed?: number;
  durationSeconds?: number;
}

export interface LaunchProgress {
  total: number;
  completed: number;
  failed: number;
  percent: number;
}

/** GET /admin/launch/status — 200 even when disabled (`active:false, state:"disabled"`). */
export interface LaunchStatusResponse {
  active: boolean;
  state: string; // disabled | idle | clearing | warming | awaiting_approval | completed | aborted | error
  progress?: LaunchProgress;
  startedAt?: string;
}

// =============================================================================
// Cache Warmer Types  (/admin/warmer/*)
// =============================================================================

export type WarmerState = 'idle' | 'running' | 'paused_for_launch';

export interface WarmerRunProgress {
  total: number;
  completed: number;
  failed: number;
  bytesCached: number;
  percent: number;
}

export interface WarmerLastRun {
  startedAt?: string;
  completedAt?: string;
  total: number;
  completed: number;
  failed: number;
  skippedUncacheable: number;
  bytesCached: number;
  durationMs: number;
  cancelled: boolean;
}

/** GET /admin/warmer/status */
export interface WarmerStatusResponse {
  enabled: boolean;
  state: WarmerState;
  schedule?: { mode: string; value?: string };
  nextScheduledRun?: string;
  currentRun?: WarmerRunProgress;
  lastRun?: WarmerLastRun;
}

/** POST /admin/warmer/queue → { status:"queued", received } */
export interface WarmerQueueResponse {
  status: string;
  received: number;
}

/** POST /admin/warmer/run → { status:"started", queued } */
export interface WarmerRunResponse {
  status: string;
  queued: number;
  /** Which sources the run warms: the configured ones, or those in the request (1.8.0+). */
  source?: 'config' | 'request';
}

/** POST /admin/warmer/cancel → { status:"cancelled", cancelledTotal } */
export interface WarmerCancelResponse {
  status: string;
  cancelledTotal: number;
}

// =============================================================================
// Reflect Mode Types  (/admin/reflect/*)
// =============================================================================

export type ReflectLevel = 'full' | 'selective' | 'ttl_extension';

/** Body for POST /admin/reflect/enable. */
export interface ReflectEnableOptions {
  level?: ReflectLevel;
  /** humantime duration, e.g. "30m", "2h"; omit for the configured/auto cap. */
  duration?: string;
  reason?: string;
}

/** GET /admin/reflect/status */
export interface ReflectStatusResponse {
  enabled: boolean;
  mode?: ReflectLevel | string;
  enabledAt?: string;
  reason?: string;
  duration?: string;
  queuedPurges: number;
  blockedPurgeRequests: number;
}

/** POST /admin/reflect/disable (mode: "replay" | "hard"). */
export interface ReflectDisableResponse {
  status: string;
  mode: string;
  duration: string;
  queuedPurges: number;
  targetsAffected?: number;
}

/** GET /admin/reflect/queue — the deferred purges. */
export interface ReflectQueueResponse {
  items: Array<Record<string, unknown>>;
  total?: number;
  truncated?: boolean;
}

// =============================================================================
// Cache Browsing Types
// =============================================================================

export interface CacheEntryInfo {
  storageKey: string;
  url: string;
  host: string;
  method: string;
  tags: string[];
  size: number;
  createdAt: string;
  expiresAt: string;
  ttl: number;
  /** Vary dimensions: array of [header, value] pairs */
  vary?: Array<[string, string]>;
}

export interface CacheEntriesResponse {
  entries: CacheEntryInfo[];
  total: number;
  hasMore: boolean;
}

export interface CacheEntryResponse {
  found: boolean;
  entry?: CacheEntryInfo;
  storageKey?: string;
  status?: string;
  ttlRemaining?: number;
  age?: number;
  tags?: string[];
  hits?: number;
  statusCode?: number;
  contentLength?: number;
  vary?: Array<[string, string]>;
  etag?: string;
  lastModified?: string;
  contentType?: string;
  compressed?: boolean;
  compressionAlgorithm?: string;
  /** Base64-encoded body, only present if include_body=true */
  body?: string;
}

/** Optional cache-key components for a coverage check (defaults applied server-side). */
export interface CacheCoverageOptions {
  host?: string;
  scheme?: 'http' | 'https';
  method?: string;
}

/** Per-URL coverage result (keys camelCased from the API by the client). */
export interface CacheCoverageEntry {
  url: string;
  cached: boolean;
  status?: 'fresh' | 'stale' | 'expired';
  ageS?: number;
  ttlS?: number;
  size?: number;
}

/** Response from POST /admin/cache/coverage. */
export interface CacheCoverageResponse {
  total: number;
  cached: number;
  uncached: number;
  percentCached: number;
  results: CacheCoverageEntry[];
}

export interface CacheTagInfo {
  tag: string;
  entryCount: number;
}

export interface CacheTagsResponse {
  tags: CacheTagInfo[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Advanced Stats Types
// =============================================================================

export interface ProtectionStatsResponse {
  backends: Record<string, {
    circuitState: 'closed' | 'open' | 'half-open';
    failureCount: number;
    successCount: number;
    lastFailure?: string;
    cooldownEndsAt?: string;
  }>;
}

/**
 * Per-category byte totals from the memory registry.
 * Mirrors `trident_core::memory::CategoryBytes` (snake_case keys are
 * transformed to camelCase by the client).
 */
export interface CategoryBytes {
  /** Stable label, e.g. 'cache_entry_bodies', 'tag_index'. */
  category: string;
  /** Band: 'resident' or 'transient'. */
  band: 'resident' | 'transient' | string;
  /** Bytes currently attributed to this category. */
  logicalBytes: number;
  /** Backing-allocation capacity, when known (container-backed categories). */
  capacityBytes?: number;
}

/**
 * Allocator-level numbers sampled from the active global allocator.
 * Mirrors `trident_core::memory::AllocatorBand`. Despite the `mimalloc*`
 * naming the values reflect whichever allocator is active at build time.
 */
export interface AllocatorBand {
  /** Current process RSS in bytes. */
  rssBytes: number;
  /** Peak process RSS in bytes. */
  peakRssBytes: number;
  /** Bytes currently committed by the active allocator. */
  mimallocCommittedBytes: number;
  /** Peak bytes committed by the active allocator. */
  peakCommittedBytes: number;
  /** `rss - committed`, clamped to >= 0: code, stacks, mmap'd files. */
  nonMimallocBytes: number;
}

/**
 * A full memory accounting snapshot.
 * Mirrors `trident_core::memory::MemorySnapshot`.
 */
export interface MemorySnapshot {
  /** Per-category breakdowns. */
  categories: CategoryBytes[];
  /** Allocator-level summary numbers. */
  allocator: AllocatorBand;
  /** Sum of resident + transient logical bytes. */
  trackedLogicalBytes: number;
  /** Sum of resident capacity bytes (falling back to logical) + transient logical. */
  trackedCapacityBytes: number;
  /** Committed bytes not accounted for by any tracked category, clamped to >= 0. */
  untrackedBytes: number;
  /** `untrackedBytes` as a fraction of `rssBytes` (0.0..=1.0). */
  untrackedFraction: number;
}

/** Per-entry memory footprint percentiles (sampled up to 1 000 entries). */
export interface FootprintPercentiles {
  /** Number of entries sampled. */
  count: number;
  /** 50th-percentile per-entry footprint in bytes. */
  p50: number;
  /** 95th-percentile per-entry footprint in bytes. */
  p95: number;
  /** 99th-percentile per-entry footprint in bytes. */
  p99: number;
}

/**
 * Response for `GET /admin/memory` — BP-59 snapshot + per-entry footprint
 * percentiles. Mirrors `trident_core::server::admin::MemorySnapshotResponse`.
 */
export interface MemorySnapshotResponse {
  /** Point-in-time memory accounting snapshot. */
  snapshot: MemorySnapshot;
  /** Per-entry footprint percentiles sampled from up to 1 000 live entries. */
  footprintPercentiles: FootprintPercentiles;
}

/**
 * Response for `POST /admin/memory/collect` — snapshots before and after
 * forcing an allocator collect cycle. Mirrors
 * `trident_core::server::admin::MemoryCollectResponse`.
 */
export interface MemoryCollectResponse {
  /** Snapshot taken immediately before the collect call. */
  before: MemorySnapshot;
  /** Snapshot taken immediately after the collect call. */
  after: MemorySnapshot;
}

/**
 * @deprecated Use {@link MemorySnapshotResponse}. The old flat
 * `{ totalBytes, cacheBytes, ... }` shape was never returned by any Trident
 * endpoint; `memoryStats()` now hits `GET /admin/memory` and returns the
 * real nested snapshot.
 */
export type MemoryStatsResponse = MemorySnapshotResponse;

export interface ConnectionPoolInfo {
  backend: string;
  active: number;
  idle: number;
  maxConnections: number;
  waitingRequests: number;
}

export interface ConnectionsResponse {
  pools: ConnectionPoolInfo[];
  totalActive: number;
  totalIdle: number;
}

// =============================================================================
// Snapshot Types
// =============================================================================

export interface SnapshotResponse {
  success: boolean;
  path?: string;
  entryCount?: number;
  fileSize?: number;
  durationMs?: number;
  compressed?: boolean;
  error?: string;
  /** @deprecated Alias of entryCount retained for existing callers. */
  entriesCount?: number;
  /** @deprecated Alias of fileSize retained for existing callers. */
  sizeBytes?: number;
  /** @deprecated Alias of durationMs; measured in milliseconds. */
  duration?: number;
}

// =============================================================================
// Discovery Types
// =============================================================================

export interface DiscoveryResolverStats {
  attempts: number;
  successes: number;
  failures: number;
  changes: number;
  /** Unix epoch milliseconds; zero if no successful resolution. */
  lastSuccess: number;
  lastFailure: number;
  currentAddresses: number;
}

export interface DiscoveryBackend {
  backendName: string;
  hostname: string;
  port: number;
  method: string;
  addresses: string[];
  primary: string | null;
  fromCache: boolean;
  stats: DiscoveryResolverStats;
}

export interface DiscoveryListResponse {
  count: number;
  backends: DiscoveryBackend[];
}

export interface DiscoveryDetailResponse extends DiscoveryBackend {
  addressCount: number;
  ipHealth: Array<{ address: string; healthy: boolean }>;
}

export interface DiscoveryRefreshResponse {
  success: boolean;
  backendName: string;
  addressCount: number;
  addresses: string[];
  error?: string;
}

// =============================================================================
// Denoiser Types
// =============================================================================

export interface QueryDenoiserReport {
  enabled: boolean;
  scopes: number;
  paramsNoise: number;
  paramsSignal: number;
  topNoise: string[];
  topSignal: string[];
}

export interface PathDenoiserReport {
  enabled: boolean;
  zonesDead: number;
  zonesAlive: number;
  zonesLearning: number;
}

export interface DenoiserReportResponse {
  queryDenoiser: QueryDenoiserReport;
  pathDenoiser: PathDenoiserReport;
}

export interface QueryScopeDetail {
  /** Scope identifier: 'host|path_prefix' */
  scopeKey: string;
  noise: string[];
  signal: string[];
}

export interface PathZoneDetail {
  /** Zone identifier: 'host|path_prefix' */
  zoneKey: string;
  /** 'dead' | 'alive' | 'learning' */
  status: string;
}

export interface QueryPinOptions {
  /** Parameter name */
  param: string;
  /** Classification */
  class: 'noise' | 'signal';
  /** Host (optional, defaults to '*') */
  host?: string;
  /** Path prefix (optional, defaults to '/') */
  pathPrefix?: string;
}

export interface QueryUnpinOptions {
  param: string;
  host?: string;
  pathPrefix?: string;
}

export interface PathPinOptions {
  /** Zone status */
  status: 'dead' | 'alive';
  host?: string;
  pathPrefix?: string;
}

export interface PathUnpinOptions {
  host?: string;
  pathPrefix?: string;
}

export interface PathDeleteZoneOptions {
  /** Host (optional, defaults to '*') */
  host?: string;
  /** Path prefix (optional, defaults to '/') */
  pathPrefix?: string;
}

export interface QueryDeleteScopeOptions {
  /** Host (optional, defaults to '*') */
  host?: string;
  /** Path prefix (optional, defaults to '/') */
  pathPrefix?: string;
}

/** Response for the denoiser zone/scope delete endpoints. */
export interface DenoiserDeleteResponse {
  /** true when a zone/scope was removed, false when it was not present (404). */
  deleted: boolean;
  host: string;
  pathPrefix: string;
}

export interface WafDeadZone {
  zoneKey: string;
  action: string;
}

export interface WafExportResponse {
  queryNoiseParams: string[];
  deadZones: WafDeadZone[];
  format: string;
}

// =============================================================================
// Server-Sent Events Types
// =============================================================================

export interface TridentEvent {
  type: 'purge' | 'cache_hit' | 'cache_miss' | 'backend_health' | 'config_reload' | 'error';
  timestamp: string;
  data: Record<string, unknown>;
}

export type EventCallback = (event: TridentEvent) => void;

// =============================================================================
// Legacy Types (for backwards compatibility)
// =============================================================================

/** @deprecated Use CacheStatsResponse instead */
export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  hitRatio: number;
  bytes: number;
  evictions: number;
  uptime: number;
}

/** @deprecated Use BackendInfo instead */
export interface BackendStats {
  name: string;
  url: string;
  healthy: boolean;
  requests: number;
  failures: number;
  avgResponseTime: number;
}

/** @deprecated Use stats() instead */
export interface StatsResponse {
  cache: CacheStats;
  backends: BackendStats[];
  version: string;
}

/** @deprecated Use RefreshQueueResponse instead */
export interface RefreshQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/** @deprecated Use TopUrlEntry instead */
export interface DiscoveredUrl {
  url: string;
  tags: string[];
  hits: number;
  lastAccess: string;
}

/** @deprecated Use TopUrlsResponse instead */
export interface DiscoveryResponse {
  urls: DiscoveredUrl[];
  total: number;
}

// =============================================================================
// Middleware Types
// =============================================================================

export interface MiddlewareOptions {
  /** Default cache TTL in seconds */
  defaultTtl?: number;
  /** Default stale-while-revalidate in seconds */
  defaultSwr?: number;
  /** Default cache tags */
  defaultTags?: string[];
  /** Skip caching for authenticated users */
  skipAuthenticated?: boolean;
  /** Custom function to determine cacheability */
  shouldCache?: (req: Request) => boolean;
  /** Custom function to generate cache tags */
  generateTags?: (req: Request) => string[];
}

export interface TridentRequest extends Request {
  /** Trident-specific cache options */
  trident?: {
    /** Cache tags for this request */
    tags?: string[];
    /** TTL override in seconds */
    ttl?: number;
    /** Skip cache for this request */
    skipCache?: boolean;
  };
}

// =============================================================================
// Header Constants
// =============================================================================

export const HEADER_CACHE_TAGS = 'X-Cache-Tags';
export const HEADER_SURROGATE_KEY = 'Surrogate-Key';
export const HEADER_SURROGATE_CONTROL = 'Surrogate-Control';
export const HEADER_CACHE_CONTROL = 'Cache-Control';
export const HEADER_VARY = 'Vary';
export const HEADER_X_TRIDENT_TTL = 'X-Trident-TTL';
export const HEADER_X_TRIDENT_SWR = 'X-Trident-SWR';

/**
 * Response for `GET /admin/status` — license / degraded-mode (Trident 1.5.0).
 */
export interface StatusResponse {
  /** Always "ok" — the endpoint is reachable and Trident is running. */
  status: string;
  /** Trident version, e.g. "1.5.0". */
  version: string;
  /** License status: "valid" | "trial" | "expired" | "unlicensed" | "unknown". */
  license: string;
  /**
   * Operating mode: "licensed" (caching active), "degraded" (license check
   * failed → pass-through, no caching), or "unknown" (no license manager).
   */
  mode: 'licensed' | 'degraded' | 'unknown';
}

/**
 * Request body for `POST /admin/explain` — dry-run cacheability (Trident 1.5.0).
 */
export interface ExplainRequest {
  /** HTTP method, e.g. "GET" or "POST". */
  method: string;
  /** URL path ("/products/42") or a full URL. */
  url: string;
  /** Optional request headers to simulate (e.g. Authorization, Cookie). */
  headers?: Record<string, string>;
  /** When true, populate cacheKey / entry / denoiser detail. */
  detail?: boolean;
}

/** Cache-key detail in an {@link ExplainResponse} (detail mode). */
export interface ExplainKey {
  /** Hex cache-key hash. */
  hash: string;
  /** Human-readable key components. */
  components: string;
}

/** Cached-entry metadata in an {@link ExplainResponse} (detail mode). */
export interface ExplainEntry {
  /** Whether a cache entry currently exists for this key. */
  present: boolean;
  ttl_remaining_secs: number | null;
  age_secs: number | null;
  tags: string[] | null;
  vary: string[] | null;
  etag: string | null;
  size_bytes: number | null;
  cache_control: string | null;
}

/**
 * Response for `POST /admin/explain` (Trident 1.5.0). Explains whether a
 * hypothetical request would hit, miss, or pass — and why.
 */
export interface ExplainResponse {
  /** Cache decision: "hit" | "miss" | "pass". */
  verdict: 'hit' | 'miss' | 'pass';
  /** Whether the request is cache-eligible. */
  cacheable: boolean;
  /** Content visibility: "private" | "public". */
  visibility: 'private' | 'public';
  /** Human-readable explanation of the verdict. */
  reason: string;
  /** Cache-key detail (detail mode only). */
  cache_key?: ExplainKey;
  /** Cached-entry metadata (detail mode only). */
  entry?: ExplainEntry;
  /** Denoiser classification (detail mode + active denoiser). */
  denoiser?: unknown;
}
