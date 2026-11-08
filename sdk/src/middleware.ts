/**
 * Trident Cache SDK - Express/Connect Middleware
 *
 * @package @trident-cache/sdk
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { MiddlewareOptions } from './types';
import {
  buildCacheControl,
  buildSurrogateControl,
  buildCacheTags,
  buildSurrogateKeys,
} from './headers';
import {
  HEADER_CACHE_TAGS,
  HEADER_SURROGATE_KEY,
  HEADER_SURROGATE_CONTROL,
  HEADER_CACHE_CONTROL,
} from './types';

// =============================================================================
// Types for Express/Connect compatibility
// =============================================================================

interface Request extends IncomingMessage {
  path?: string;
  originalUrl?: string;
  cookies?: Record<string, string>;
  session?: unknown;
  user?: unknown;
}

interface Response extends ServerResponse {
  locals?: Record<string, unknown>;
}

type NextFunction = (err?: Error) => void;

// =============================================================================
// Response Extension
// =============================================================================

/**
 * Extended response object with Trident helpers
 */
export interface TridentResponse extends Response {
  /** Set cache TTL in seconds */
  setTTL(seconds: number): TridentResponse;
  /** Set stale-while-revalidate in seconds */
  setSWR(seconds: number): TridentResponse;
  /** Add cache tags */
  addTags(...tags: string[]): TridentResponse;
  /** Set cache as private */
  setPrivate(): TridentResponse;
  /** Disable caching for this response */
  setNoCache(): TridentResponse;
}

// =============================================================================
// Middleware Factory
// =============================================================================

/**
 * Create Trident caching middleware for Express/Connect
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { tridentMiddleware } from '@trident-cache/sdk';
 *
 * const app = express();
 *
 * app.use(tridentMiddleware({
 *   defaultTtl: 3600,
 *   defaultSwr: 86400,
 *   skipAuthenticated: true,
 * }));
 *
 * app.get('/products', (req, res) => {
 *   res.addTags('products', 'catalog');
 *   res.json({ products: [...] });
 * });
 * ```
 */
export function tridentMiddleware(options: MiddlewareOptions = {}) {
  const {
    defaultTtl = 3600,
    defaultSwr = 86400,
    defaultTags = [],
    skipAuthenticated = true,
    shouldCache,
    generateTags,
  } = options;

  return function middleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Track cache state for this request
    let ttl = defaultTtl;
    let swr = defaultSwr;
    let isPrivate = false;
    let noCache = false;
    const tags: string[] = [...defaultTags];

    // Extend response with Trident helpers
    const tridentRes = res as TridentResponse;

    tridentRes.setTTL = function (seconds: number): TridentResponse {
      ttl = seconds;
      return this;
    };

    tridentRes.setSWR = function (seconds: number): TridentResponse {
      swr = seconds;
      return this;
    };

    tridentRes.addTags = function (...newTags: string[]): TridentResponse {
      tags.push(...newTags);
      return this;
    };

    tridentRes.setPrivate = function (): TridentResponse {
      isPrivate = true;
      return this;
    };

    tridentRes.setNoCache = function (): TridentResponse {
      noCache = true;
      return this;
    };

    // Store original end to intercept
    const originalEnd = res.end.bind(res);

    // Override end to add cache headers before sending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): ServerResponse {
      // Determine if we should cache this response
      let shouldCacheResponse = true;

      // Check custom shouldCache function
      if (shouldCache && !shouldCache(req as unknown as globalThis.Request)) {
        shouldCacheResponse = false;
      }

      // Skip if explicitly set to no-cache
      if (noCache) {
        shouldCacheResponse = false;
      }

      // Skip authenticated users if configured
      if (skipAuthenticated) {
        if (req.user || req.session || req.cookies?.['session']) {
          isPrivate = true;
        }
      }

      // Skip non-successful responses
      const statusCode = res.statusCode;
      if (statusCode < 200 || statusCode >= 400) {
        shouldCacheResponse = false;
      }

      // Skip if response already has cache headers
      if (res.getHeader(HEADER_CACHE_CONTROL)) {
        shouldCacheResponse = false;
      }

      // Apply cache headers
      if (shouldCacheResponse) {
        if (isPrivate) {
          // Private cache for authenticated users
          res.setHeader(
            HEADER_CACHE_CONTROL,
            buildCacheControl({
              cacheability: 'private',
              maxAge: ttl,
            })
          );
        } else {
          // Public cache
          res.setHeader(
            HEADER_CACHE_CONTROL,
            buildCacheControl({
              cacheability: 'public',
              maxAge: ttl,
              sMaxAge: ttl,
              staleWhileRevalidate: swr,
            })
          );

          res.setHeader(
            HEADER_SURROGATE_CONTROL,
            buildSurrogateControl({
              maxAge: ttl,
              staleWhileRevalidate: swr,
            })
          );
        }

        // Add custom tags from generateTags
        if (generateTags) {
          const customTags = generateTags(req as unknown as globalThis.Request);
          tags.push(...customTags);
        }

        // Add tags if any
        if (tags.length > 0) {
          const uniqueTags = [...new Set(tags)];
          res.setHeader(HEADER_CACHE_TAGS, buildCacheTags(uniqueTags));
          res.setHeader(HEADER_SURROGATE_KEY, buildSurrogateKeys(uniqueTags));
        }
      } else if (noCache) {
        // Explicitly prevent caching
        res.setHeader(
          HEADER_CACHE_CONTROL,
          buildCacheControl({
            cacheability: 'no-store',
          })
        );
        res.setHeader(
          HEADER_SURROGATE_CONTROL,
          buildSurrogateControl({
            noStore: true,
          })
        );
      }

      // Call original end
      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      }
      if (encoding !== undefined) {
        return originalEnd(chunk, encoding, callback);
      }
      return originalEnd(chunk);
    } as typeof res.end;

    next();
  };
}

// =============================================================================
// Route-specific middleware helpers
// =============================================================================

/**
 * Set cache TTL for a specific route
 *
 * @example
 * ```typescript
 * app.get('/static-page', cacheTTL(86400), (req, res) => {
 *   res.send('Cached for 24 hours');
 * });
 * ```
 */
export function cacheTTL(seconds: number) {
  return function (_req: Request, res: Response, next: NextFunction): void {
    const tridentRes = res as TridentResponse;
    if (tridentRes.setTTL) {
      tridentRes.setTTL(seconds);
    }
    next();
  };
}

/**
 * Add cache tags to a route
 *
 * @example
 * ```typescript
 * app.get('/products/:id', withTags('products'), (req, res) => {
 *   res.addTags(`product-${req.params.id}`);
 *   res.json({ ... });
 * });
 * ```
 */
export function withTags(...tags: string[]) {
  return function (_req: Request, res: Response, next: NextFunction): void {
    const tridentRes = res as TridentResponse;
    if (tridentRes.addTags) {
      tridentRes.addTags(...tags);
    }
    next();
  };
}

/**
 * Mark route as private (user-specific caching)
 */
export function privateCacheMiddleware() {
  return function (_req: Request, res: Response, next: NextFunction): void {
    const tridentRes = res as TridentResponse;
    if (tridentRes.setPrivate) {
      tridentRes.setPrivate();
    }
    next();
  };
}

/**
 * Disable caching for a route
 */
export function noCacheMiddleware() {
  return function (_req: Request, res: Response, next: NextFunction): void {
    const tridentRes = res as TridentResponse;
    if (tridentRes.setNoCache) {
      tridentRes.setNoCache();
    }
    next();
  };
}
