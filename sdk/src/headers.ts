/**
 * Trident Cache SDK - Cache Header Helpers
 *
 * @package @trident-cache/sdk
 */

import type {
  CacheControlOptions,
  SurrogateControlOptions,
} from './types';

import {
  HEADER_CACHE_TAGS,
  HEADER_SURROGATE_KEY,
  HEADER_SURROGATE_CONTROL,
  HEADER_CACHE_CONTROL,
  HEADER_VARY,
  HEADER_X_TRIDENT_TTL,
  HEADER_X_TRIDENT_SWR,
} from './types';

// =============================================================================
// Cache-Control Header Builder
// =============================================================================

/**
 * Build a Cache-Control header value from options
 */
export function buildCacheControl(options: CacheControlOptions): string {
  const directives: string[] = [];

  if (options.cacheability) {
    directives.push(options.cacheability);
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (options.proxyRevalidate) {
    directives.push('proxy-revalidate');
  }

  if (options.immutable) {
    directives.push('immutable');
  }

  if (options.noTransform) {
    directives.push('no-transform');
  }

  return directives.join(', ');
}

/**
 * Parse a Cache-Control header value into options
 */
export function parseCacheControl(header: string): CacheControlOptions {
  const options: CacheControlOptions = {};
  const directives = header.split(',').map((d) => d.trim().toLowerCase());

  for (const directive of directives) {
    if (directive === 'public') {
      options.cacheability = 'public';
    } else if (directive === 'private') {
      options.cacheability = 'private';
    } else if (directive === 'no-cache') {
      options.cacheability = 'no-cache';
    } else if (directive === 'no-store') {
      options.cacheability = 'no-store';
    } else if (directive.startsWith('max-age=')) {
      options.maxAge = parseInt(directive.split('=')[1], 10);
    } else if (directive.startsWith('s-maxage=')) {
      options.sMaxAge = parseInt(directive.split('=')[1], 10);
    } else if (directive.startsWith('stale-while-revalidate=')) {
      options.staleWhileRevalidate = parseInt(directive.split('=')[1], 10);
    } else if (directive.startsWith('stale-if-error=')) {
      options.staleIfError = parseInt(directive.split('=')[1], 10);
    } else if (directive === 'must-revalidate') {
      options.mustRevalidate = true;
    } else if (directive === 'proxy-revalidate') {
      options.proxyRevalidate = true;
    } else if (directive === 'immutable') {
      options.immutable = true;
    } else if (directive === 'no-transform') {
      options.noTransform = true;
    }
  }

  return options;
}

// =============================================================================
// Surrogate-Control Header Builder
// =============================================================================

/**
 * Build a Surrogate-Control header value from options
 */
export function buildSurrogateControl(options: SurrogateControlOptions): string {
  const directives: string[] = [];

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.noStore) {
    directives.push('no-store');
  }

  if (options.content) {
    directives.push(`content="${options.content}"`);
  }

  return directives.join(', ');
}

// =============================================================================
// Cache Tags Helpers
// =============================================================================

/**
 * Build cache tags header value from an array of tags
 * Uses comma-separated format for X-Cache-Tags
 */
export function buildCacheTags(tags: string[]): string {
  return tags.map((tag) => tag.trim()).filter(Boolean).join(',');
}

/**
 * Build Surrogate-Key header value from an array of tags
 * Uses space-separated format (Varnish/Fastly compatible)
 */
export function buildSurrogateKeys(tags: string[]): string {
  return tags.map((tag) => tag.trim()).filter(Boolean).join(' ');
}

/**
 * Parse cache tags from header value
 * Supports both comma and space separated formats
 */
export function parseCacheTags(header: string): string[] {
  // Support both comma-separated and space-separated formats
  return header
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// =============================================================================
// Header Object Builder
// =============================================================================

export interface CacheHeaders {
  /** Cache-Control header value */
  cacheControl?: string;
  /** Surrogate-Control header value */
  surrogateControl?: string;
  /** Cache tags (X-Cache-Tags) */
  cacheTags?: string;
  /** Surrogate keys (space-separated) */
  surrogateKeys?: string;
  /** Vary header value */
  vary?: string;
  /** Trident TTL override */
  ttl?: number;
  /** Trident SWR override */
  swr?: number;
}

/**
 * Build a headers object ready to be used with fetch or Response
 */
export function buildHeaders(options: CacheHeaders): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.cacheControl) {
    headers[HEADER_CACHE_CONTROL] = options.cacheControl;
  }

  if (options.surrogateControl) {
    headers[HEADER_SURROGATE_CONTROL] = options.surrogateControl;
  }

  if (options.cacheTags) {
    headers[HEADER_CACHE_TAGS] = options.cacheTags;
  }

  if (options.surrogateKeys) {
    headers[HEADER_SURROGATE_KEY] = options.surrogateKeys;
  }

  if (options.vary) {
    headers[HEADER_VARY] = options.vary;
  }

  if (options.ttl !== undefined) {
    headers[HEADER_X_TRIDENT_TTL] = options.ttl.toString();
  }

  if (options.swr !== undefined) {
    headers[HEADER_X_TRIDENT_SWR] = options.swr.toString();
  }

  return headers;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create headers for a public cacheable response
 */
export function publicCache(
  maxAge: number,
  options?: {
    swr?: number;
    tags?: string[];
    vary?: string[];
  }
): Record<string, string> {
  const cacheControl = buildCacheControl({
    cacheability: 'public',
    maxAge,
    sMaxAge: maxAge,
    staleWhileRevalidate: options?.swr,
  });

  const headers: CacheHeaders = {
    cacheControl,
  };

  if (options?.tags?.length) {
    headers.cacheTags = buildCacheTags(options.tags);
    headers.surrogateKeys = buildSurrogateKeys(options.tags);
  }

  if (options?.vary?.length) {
    headers.vary = options.vary.join(', ');
  }

  return buildHeaders(headers);
}

/**
 * Create headers for a private (user-specific) response
 */
export function privateCache(maxAge: number): Record<string, string> {
  return buildHeaders({
    cacheControl: buildCacheControl({
      cacheability: 'private',
      maxAge,
    }),
  });
}

/**
 * Create headers to prevent caching
 */
export function noCache(): Record<string, string> {
  return buildHeaders({
    cacheControl: buildCacheControl({
      cacheability: 'no-store',
    }),
    surrogateControl: buildSurrogateControl({
      noStore: true,
    }),
  });
}

/**
 * Create headers for immutable static assets
 */
export function immutableCache(maxAge: number = 31536000): Record<string, string> {
  return buildHeaders({
    cacheControl: buildCacheControl({
      cacheability: 'public',
      maxAge,
      immutable: true,
    }),
  });
}

/**
 * Create cache tags header
 */
export function cacheTags(...tags: string[]): Record<string, string> {
  return buildHeaders({
    cacheTags: buildCacheTags(tags),
    surrogateKeys: buildSurrogateKeys(tags),
  });
}
