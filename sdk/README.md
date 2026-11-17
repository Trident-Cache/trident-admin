# @trident-cache/sdk

Official Node.js/TypeScript SDK for [Trident HTTP Cache](https://trident-cache.dev).

## Installation

```bash
npm install @trident-cache/sdk
# or
yarn add @trident-cache/sdk
# or
pnpm add @trident-cache/sdk
```

## Features

- **Admin Client** - Purge cache, get stats, manage backends
- **Cache Headers** - Build and parse Cache-Control, Surrogate-Control headers
- **Express Middleware** - Automatic cache header management
- **TypeScript Support** - Full type definitions included

## Quick Start

### Admin Client

```typescript
import { createClient } from '@trident-cache/sdk';

const trident = createClient({
  adminUrl: 'http://localhost:9301',
  // authToken: 'your-token', // Optional
});

// Purge by URL
// Give the full URL (or `host`): a path alone names no host.
await trident.purgeUrl({ url: 'https://www.example.com/products/123' });

// Purge by tags
await trident.purgeByTags({ tags: ['product-123', 'catalog'] });

// Get stats
const stats = await trident.getStats();
console.log(`Hit ratio: ${stats.cache.hitRatio}`);
```

### Cache Headers

```typescript
import { publicCache, cacheTags, buildCacheControl } from '@trident-cache/sdk';

// Simple public cache (1 hour TTL, 24h SWR)
const headers = publicCache(3600, {
  swr: 86400,
  tags: ['products', 'catalog'],
});

// Custom Cache-Control
const cacheControl = buildCacheControl({
  cacheability: 'public',
  maxAge: 3600,
  sMaxAge: 7200,
  staleWhileRevalidate: 86400,
  staleIfError: 172800,
});
```

### Express Middleware

```typescript
import express from 'express';
import { tridentMiddleware, cacheTTL, withTags } from '@trident-cache/sdk';

const app = express();

// Global middleware with defaults
app.use(tridentMiddleware({
  defaultTtl: 3600,           // 1 hour default
  defaultSwr: 86400,          // 24h stale-while-revalidate
  skipAuthenticated: true,    // Private cache for logged-in users
}));

// Per-route configuration
app.get('/products', withTags('products', 'catalog'), (req, res) => {
  res.addTags('store-1');     // Add more tags
  res.json({ products: [...] });
});

// Static content with long TTL
app.get('/static/*', cacheTTL(31536000), (req, res) => {
  // Served with 1-year cache
});

// Disable caching for specific routes
app.post('/api/*', (req, res, next) => {
  res.setNoCache();
  next();
});
```

## Durable purges: `@trident-cache/sdk/delivery` (Node.js)

A site that changes content must purge Trident, and must not lose that purge
when Trident is restarting, the token was rotated, or the request dies halfway.
The same contract as the PHP (`qoliber/trident-php`) and Python (`trident-cache`)
libraries, checked against the same test vectors (`integrations/contract`):

```ts
import { Delivery, resolveSettings, TagPolicy } from '@trident-cache/sdk/delivery';

const delivery = new Delivery(resolveSettings(), store, { policy: new TagPolicy('', ['article_']) });
await delivery.recordTags(['article_42', 'articles']);   // in the change's transaction (your store)
// ...
await delivery.flush();                                   // after the response: deliver what was recorded
await delivery.drain();                                   // from a scheduler: retry what is owed
```

- **`OutboxStore`** is the one piece an application writes: rows in its own
  database (any driver), so a purge commits or rolls back with the change.
  `MemoryOutboxStore` is for tests only; it is not durable.
- **Removal:** a row is removed only when Trident acknowledged the purge
  (`purgeFailure`). Anything else is retried with backoff.
- **Second delivery:** each delivered purge goes out once more 10 s later.
- **Instances:** several instances (`TRIDENT_INSTANCES`) are purged and retried
  independently.
- **Tag policy:** tags are normalised and bounded as Trident expects
  (`TagPolicy`: 200 tags, identity tags first, an overflow tag).
- **Outbound HTTP:** `node:http(s)`, pinned to the address the network guard
  checked (link-local and cloud-metadata addresses are refused), with no proxy
  and no redirects.
- **Tests:** `FakeTransport` is a fake Trident for them.
- **Node.js only:** the package's main entry (the admin client and header
  helpers) stays usable in browsers and edge runtimes.

## API Reference

### TridentClient

#### Constructor

```typescript
const client = createClient({
  adminUrl: string;        // Required: Trident admin API URL
  authToken?: string;      // Optional: Bearer token
  timeout?: number;        // Optional: Request timeout (default: 5000ms)
  fetch?: typeof fetch;    // Optional: Custom fetch implementation
});
```

#### Purge Methods

```typescript
// Purge specific URL
await client.purgeUrl({
  url: '/path',
  host?: 'example.com',
  method?: 'GET',
});

// Purge by cache tags
await client.purgeByTags({
  tags: ['tag1', 'tag2'],
});

// Purge by regex pattern
await client.purgeByPattern({
  pattern: '^/products/.*',
});

// Purge all entries for a host
await client.purgeByHost({
  host: 'example.com',
});

// Purge everything
await client.purgeAll();
```

#### Stats Methods

```typescript
// Get cache and backend stats
const stats = await client.getStats();
// Returns: { cache: CacheStats, backends: BackendStats[], version: string }

// Get refresh queue stats
const queue = await client.getRefreshQueueStats();
// Returns: { pending, processing, completed, failed }
```

#### Launch Mode

Launch is a singleton and requires explicit URLs. Use camelCase controls in
TypeScript; the client sends the native snake_case API fields, including
maintenance overrides. Explicit `false` and empty bypass arrays are preserved;
omitted controls remain absent for the server's configured defaults. Named
launches, sitemap submission and unsupported controls are rejected before HTTP.

```typescript
await client.launchStart({
  urls: ['/products/42', '/categories/sale'],
  autoComplete: false,
  bypassPaths: ['/preview/42'],
  maintenance: { title: 'Preparing products', retryAfter: 60 },
});
```

The native Launch gate uses the built SDK and an owned candidate process,
through the shared fixture in `../python-library/tests/live_launch.py`. With
the Python SDK wheel installed, run from this package directory:

```bash
TRIDENT_BIN=/path/to/candidate TRIDENT_LICENSE_FILE=/path/to/license.key \
  TRIDENT_JS_SDK_FILE="$PWD/dist/index.mjs" \
  python ../python-library/tests/live_launch.py --client js \
    --expected-sha256 <recorded-sha256> --output /tmp/trident-native-launch-js
```

#### Other Methods

```typescript
// Health check
const healthy = await client.healthCheck();

// Query specific cache entry
const entry = await client.queryCache('/path', 'host.com');

// Clear all cache
await client.clearCache();

// Get backend status
const backends = await client.getBackends();
```

### Header Helpers

#### Cache-Control

```typescript
import { buildCacheControl, parseCacheControl } from '@trident-cache/sdk';

// Build header
const header = buildCacheControl({
  cacheability: 'public',     // 'public' | 'private' | 'no-cache' | 'no-store'
  maxAge: 3600,               // Browser cache TTL
  sMaxAge: 7200,              // CDN/proxy cache TTL
  staleWhileRevalidate: 86400,
  staleIfError: 172800,
  mustRevalidate: false,
  immutable: false,
});
// Result: "public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400"

// Parse header
const options = parseCacheControl('public, max-age=3600');
```

#### Surrogate-Control

```typescript
import { buildSurrogateControl } from '@trident-cache/sdk';

const header = buildSurrogateControl({
  maxAge: 86400,
  staleWhileRevalidate: 604800,
  noStore: false,
});
// Result: "max-age=86400, stale-while-revalidate=604800"
```

#### Cache Tags

```typescript
import { buildCacheTags, buildSurrogateKeys, parseCacheTags } from '@trident-cache/sdk';

// X-Cache-Tags format (comma-separated)
const tags = buildCacheTags(['product-123', 'catalog', 'store-1']);
// Result: "product-123,catalog,store-1"

// Surrogate-Key format (space-separated, Varnish compatible)
const keys = buildSurrogateKeys(['product-123', 'catalog']);
// Result: "product-123 catalog"

// Parse tags (supports both formats)
const parsed = parseCacheTags('product-123,catalog store-1');
// Result: ['product-123', 'catalog', 'store-1']
```

#### Convenience Functions

```typescript
import {
  publicCache,
  privateCache,
  noCache,
  immutableCache,
  cacheTags,
} from '@trident-cache/sdk';

// Public cache with tags
const headers = publicCache(3600, {
  swr: 86400,
  tags: ['products'],
  vary: ['Accept-Language'],
});

// Private (user-specific) cache
const privateHeaders = privateCache(300);

// No caching
const noCacheHeaders = noCache();

// Immutable static assets (1 year)
const staticHeaders = immutableCache();

// Just add tags
const tagHeaders = cacheTags('product-123', 'catalog');
```

### Express Middleware

#### Main Middleware

```typescript
import { tridentMiddleware } from '@trident-cache/sdk';

app.use(tridentMiddleware({
  defaultTtl?: number;           // Default cache TTL (default: 3600)
  defaultSwr?: number;           // Default SWR (default: 86400)
  defaultTags?: string[];        // Tags added to all responses
  skipAuthenticated?: boolean;   // Private cache for auth users (default: true)
  shouldCache?: (req) => boolean;  // Custom cacheability check
  generateTags?: (req) => string[]; // Generate tags from request
}));
```

#### Response Helpers

When using the middleware, responses get these helper methods:

```typescript
app.get('/example', (req, res) => {
  res.setTTL(7200);           // Override TTL
  res.setSWR(172800);         // Override SWR
  res.addTags('tag1', 'tag2'); // Add cache tags
  res.setPrivate();           // Mark as private
  res.setNoCache();           // Disable caching

  res.json({ data: '...' });
});
```

#### Route Middleware

```typescript
import { cacheTTL, withTags, privateCacheMiddleware, noCacheMiddleware } from '@trident-cache/sdk';

// Set TTL for route
app.get('/long-cache', cacheTTL(86400), handler);

// Add tags to route
app.get('/products', withTags('products'), handler);

// Mark route as private
app.get('/profile', privateCacheMiddleware(), handler);

// Disable caching
app.post('/api', noCacheMiddleware(), handler);
```

## Header Constants

```typescript
import {
  HEADER_CACHE_TAGS,        // 'X-Cache-Tags'
  HEADER_SURROGATE_KEY,     // 'Surrogate-Key'
  HEADER_SURROGATE_CONTROL, // 'Surrogate-Control'
  HEADER_CACHE_CONTROL,     // 'Cache-Control'
  HEADER_VARY,              // 'Vary'
  HEADER_X_TRIDENT_TTL,     // 'X-Trident-TTL'
  HEADER_X_TRIDENT_SWR,     // 'X-Trident-SWR'
} from '@trident-cache/sdk';
```

## Framework Examples

### Next.js (App Router)

```typescript
// app/products/page.tsx
import { publicCache, cacheTags } from '@trident-cache/sdk';

export async function generateMetadata() {
  return {
    // ...
  };
}

export default async function ProductsPage() {
  const products = await fetchProducts();

  return <ProductList products={products} />;
}

// Route segment config
export const headers = () => ({
  ...publicCache(3600, { tags: ['products'] }),
});
```

### Next.js (API Routes)

```typescript
// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { publicCache, cacheTags } from '@trident-cache/sdk';

export async function GET() {
  const products = await getProducts();

  return NextResponse.json(products, {
    headers: {
      ...publicCache(3600, {
        swr: 86400,
        tags: ['products', 'api'],
      }),
    },
  });
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import { publicCache, buildCacheTags } from '@trident-cache/sdk';

const fastify = Fastify();

fastify.get('/products', async (request, reply) => {
  const products = await getProducts();

  reply
    .headers(publicCache(3600, { tags: ['products'] }))
    .send(products);
});
```

### Koa

```typescript
import Koa from 'koa';
import { publicCache } from '@trident-cache/sdk';

const app = new Koa();

app.use(async (ctx) => {
  if (ctx.path === '/products') {
    const headers = publicCache(3600, { tags: ['products'] });
    Object.entries(headers).forEach(([k, v]) => ctx.set(k, v));
    ctx.body = await getProducts();
  }
});
```

## Error Handling

```typescript
import { TridentError } from '@trident-cache/sdk';

try {
  await client.purgeByTags({ tags: ['invalid'] });
} catch (error) {
  if (error instanceof TridentError) {
    console.error('Trident error:', error.message);
    console.error('Status:', error.statusCode);
    console.error('Response:', error.response);
  }
}
```

## TypeScript Support

All types are exported:

```typescript
import type {
  TridentConfig,
  CacheControlOptions,
  SurrogateControlOptions,
  PurgeResponse,
  StatsResponse,
  CacheStats,
  BackendStats,
  MiddlewareOptions,
} from '@trident-cache/sdk';
```

## License

MIT © [qoliber](https://qoliber.com)

## Native admin contract verification

From the engine repository root, build `integrations/js-library/tests.Dockerfile`
and run its image with the candidate and tracked licence mounted read-only,
`TRIDENT_BIN`, `TRIDENT_LICENSE_FILE`, and `TRIDENT_CONTRACT_REQUIRED=1`. Mount
`integrations/contract` at `/contract`. Run `npm test -- --run` followed by
`node test/live-admin.mjs` with `--network none`. The latter starts its own
loopback origin and candidate and verifies named DNS/backends, cached body
identity and the actual snapshot file/count/size. CI requires both.

1.8 DNS response types use `backendName`, `hostname`, `addresses` and resolver
`stats`; refresh reports `addressCount` and `addresses`. The native API does
not report a refresh `changed` flag, previous addresses or list backend health.
Snapshot uses `entryCount`, `fileSize` and millisecond `durationMs`; earlier
`entriesCount`, `sizeBytes` and `duration` are retained as derived aliases.
