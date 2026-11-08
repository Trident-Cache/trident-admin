/**
 * Trident Cache SDK - Main Entry Point
 *
 * Official Node.js/TypeScript SDK for Trident HTTP Cache
 *
 * @package @trident-cache/sdk
 */

// =============================================================================
// Client exports
// =============================================================================

export { TridentClient, TridentError, createClient } from './client';

// =============================================================================
// Header helpers exports
// =============================================================================

export {
  // Cache-Control
  buildCacheControl,
  parseCacheControl,
  // Surrogate-Control
  buildSurrogateControl,
  // Cache tags
  buildCacheTags,
  buildSurrogateKeys,
  parseCacheTags,
  // Header builders
  buildHeaders,
  // Convenience functions
  publicCache,
  privateCache,
  noCache,
  immutableCache,
  cacheTags,
} from './headers';

export type { CacheHeaders } from './headers';

// =============================================================================
// Middleware exports
// =============================================================================

export {
  tridentMiddleware,
  cacheTTL,
  withTags,
  privateCacheMiddleware,
  noCacheMiddleware,
} from './middleware';

export type { TridentResponse } from './middleware';

// =============================================================================
// Type exports
// =============================================================================

export type {
  // Config
  TridentConfig,
  // Cache control
  Cacheability,
  CacheControlOptions,
  SurrogateControlOptions,
  // Purge
  PurgeByUrlOptions,
  PurgeByTagOptions,
  PurgeByPatternOptions,
  PurgeByHostOptions,
  PurgeByVaryOptions,
  PurgeResponse,
  // Denoisers
  DenoiserReportResponse,
  QueryDenoiserReport,
  PathDenoiserReport,
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
  WafDeadZone,
  // Stats
  CacheStats,
  BackendStats,
  StatsResponse,
  RefreshQueueStats,
  CacheStatsResponse,
  TopUrlEntry,
  TopUrlsResponse,
  TagStatsResponse,
  RefreshQueueResponse,
  LatencyStatsResponse,
  ErrorEntry,
  ErrorStatsResponse,
  ProtectionStatsResponse,
  // Memory accounting (GET /admin/memory, POST /admin/memory/collect)
  CategoryBytes,
  AllocatorBand,
  MemorySnapshot,
  FootprintPercentiles,
  MemorySnapshotResponse,
  MemoryCollectResponse,
  MemoryStatsResponse,
  // Health
  HealthResponse,
  ReadyResponse,
  // Backends / connections
  BackendInfo,
  BackendsResponse,
  BackendDetailResponse,
  BackendActionResponse,
  ConnectionPoolInfo,
  ConnectionsResponse,
  // Bans
  BanInfo,
  BansResponse,
  BanCreateResponse,
  // Cache browse
  CacheEntryInfo,
  CacheEntriesResponse,
  CacheEntryResponse,
  CacheCoverageOptions,
  CacheCoverageEntry,
  CacheCoverageResponse,
  CacheTagInfo,
  CacheTagsResponse,
  // Config / rules
  ReloadResponse,
  ConfigResponse,
  RuleInfo,
  RulesResponse,
  RulesValidateResponse,
  // Discovery (DNS)
  DiscoveryBackend,
  DiscoveryListResponse,
  DiscoveryDetailResponse,
  DiscoveryRefreshResponse,
  // Snapshot / persistence
  SnapshotResponse,
  // Events
  TridentEvent,
  EventCallback,
  // Launch mode
  LaunchStartOptions,
  LaunchResponse,
  LaunchStatusResponse,
  LaunchProgress,
  // Cache warmer
  WarmerState,
  WarmerStatusResponse,
  WarmerRunProgress,
  WarmerLastRun,
  WarmerQueueResponse,
  WarmerRunResponse,
  WarmerCancelResponse,
  // Reflect mode
  ReflectLevel,
  ReflectEnableOptions,
  ReflectStatusResponse,
  ReflectDisableResponse,
  ReflectQueueResponse,
  // Discovery
  DiscoveredUrl,
  DiscoveryResponse,
  // Observability (1.5.0)
  StatusResponse,
  ExplainRequest,
  ExplainResponse,
  ExplainKey,
  ExplainEntry,
  // Middleware
  MiddlewareOptions,
  TridentRequest,
} from './types';

// =============================================================================
// Header constants exports
// =============================================================================

export {
  HEADER_CACHE_TAGS,
  HEADER_SURROGATE_KEY,
  HEADER_SURROGATE_CONTROL,
  HEADER_CACHE_CONTROL,
  HEADER_VARY,
  HEADER_X_TRIDENT_TTL,
  HEADER_X_TRIDENT_SWR,
} from './types';
