/**
 * Fetches a URL that the panel's caller supplied, without letting the caller
 * aim the panel at hosts only the panel can reach.
 *
 * Before every connection, including the one after each redirect:
 *   - only http: and https: are followed;
 *   - the host is resolved once, and refused when any address it resolves to
 *     is not public (see `address.ts`), unless the operator listed the host;
 *   - the connection goes to the address that was checked, with the original
 *     host name in the Host header and in the TLS handshake.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';
import { checkAddresses, describeAddressClass, isIpLiteral, normaliseHost } from './address';

export const ALLOWED_HOSTS_ENV = 'TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS';

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface GuardedFetchOptions {
  /** Hosts fetched whatever they resolve to. Lower-case, IPv6 without brackets. */
  allowedHosts: ReadonlySet<string>;
  /** Limit for the whole fetch: resolution, redirects and body together. */
  timeoutMs: number;
  /** Limit on the body, after any decompression. */
  maxBytes: number;
  maxRedirects: number;
  headers?: Record<string, string>;
  /** Replaces the system resolver; for tests. */
  resolve?: (host: string) => Promise<ResolvedAddress[]>;
}

/** The fetch was refused by the rules above, as opposed to having failed. */
export class FetchRefusedError extends Error {
  constructor(
    message: string,
    readonly host: string,
  ) {
    super(message);
    this.name = 'FetchRefusedError';
  }
}

async function systemResolve(host: string): Promise<ResolvedAddress[]> {
  return dnsLookup(host, { all: true, verbatim: true });
}

interface Target {
  url: URL;
  /** The addresses the connection may go to: exactly the ones that were checked. */
  pinned: ResolvedAddress[];
}

async function admit(url: URL, options: GuardedFetchOptions): Promise<Target> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchRefusedError(`Refusing to fetch ${url.protocol}// URLs; only http and https are allowed.`, url.hostname);
  }
  if (url.username !== '' || url.password !== '') {
    throw new FetchRefusedError('Refusing to fetch a URL that carries a user name or password.', url.hostname);
  }

  const host = normaliseHost(url.hostname);
  const listed = options.allowedHosts.has(host);

  let addresses: ResolvedAddress[];
  if (isIpLiteral(host)) {
    addresses = [{ address: host, family: host.includes(':') ? 6 : 4 }];
  } else {
    addresses = await (options.resolve ?? systemResolve)(host);
    if (addresses.length === 0) throw new Error(`"${host}" did not resolve to any address`);
  }

  if (!listed) {
    const verdict = checkAddresses(addresses.map((entry) => entry.address));
    if (!verdict.ok) {
      const what = verdict.address
        ? `it resolves to ${verdict.address}, ${describeAddressClass(verdict.kind ?? 'invalid')}`
        : 'it has no usable address';
      throw new FetchRefusedError(
        `Refusing to fetch from "${host}": ${what}. ` +
          `To allow this host, add it to ${ALLOWED_HOSTS_ENV} (comma-separated host names) and restart the panel.`,
        host,
      );
    }
  }
  return { url, pinned: addresses };
}

interface Reply {
  status: number;
  location: string | undefined;
  body: Readable;
  encoding: string;
  abort(): void;
}

function request(target: Target, options: GuardedFetchOptions, signal: AbortSignal): Promise<Reply> {
  const { url, pinned } = target;
  // Answers the connection's lookup with the addresses that were checked, so
  // the name is not resolved a second time.
  const pinnedLookup: LookupFunction = (_host, lookupOptions, callback) => {
    if (lookupOptions.all) callback(null, pinned);
    else callback(null, pinned[0].address, pinned[0].family);
  };

  return new Promise<Reply>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: pinnedLookup,
        signal,
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          ...options.headers,
        },
      },
      (res) => {
        const location = res.headers.location;
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(location) ? location[0] : location,
          body: res,
          encoding: String(res.headers['content-encoding'] ?? '').trim().toLowerCase(),
          abort: () => req.destroy(),
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function decoded(reply: Reply): Readable {
  const onError = (stream: Readable) => {
    reply.body.on('error', (error) => stream.destroy(error));
    return stream;
  };
  switch (reply.encoding) {
    case 'gzip':
    case 'x-gzip':
      return onError(reply.body.pipe(createGunzip()));
    case 'deflate':
      return onError(reply.body.pipe(createInflate()));
    case 'br':
      return onError(reply.body.pipe(createBrotliDecompress()));
    default:
      return reply.body;
  }
}

async function readCapped(reply: Reply, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of decoded(reply)) {
      const bytes = chunk as Buffer;
      total += bytes.length;
      if (total > maxBytes) {
        throw new Error(`response is larger than ${Math.floor(maxBytes / (1024 * 1024))} MB`);
      }
      chunks.push(bytes);
    }
  } finally {
    reply.abort();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** GET `url` under the rules at the top of this file and return the body as text. */
export async function guardedFetchText(url: string, options: GuardedFetchOptions): Promise<string> {
  const controller = new AbortController();
  let timedOut = false;
  let rejectOnTimeout: (reason: Error) => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    rejectOnTimeout = reject;
  });
  // Marked as handled: when the fetch finishes first, nothing is left awaiting it.
  deadline.catch(() => undefined);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectOnTimeout(new Error(`timed out after ${Math.round(options.timeoutMs / 1000)} s`));
  }, options.timeoutMs);

  const run = async (): Promise<string> => {
    let current = new URL(url);
    for (let hop = 0; ; hop++) {
      const target = await admit(current, options);
      const reply = await request(target, options, controller.signal);

      if (REDIRECTS.has(reply.status) && reply.location) {
        reply.abort();
        if (hop >= options.maxRedirects) throw new Error(`more than ${options.maxRedirects} redirects`);
        current = new URL(reply.location, current);
        continue;
      }
      if (reply.status < 200 || reply.status >= 300) {
        reply.abort();
        throw new Error(`HTTP ${reply.status}`);
      }
      return await readCapped(reply, options.maxBytes);
    }
  };

  try {
    // The race covers name resolution, which cannot be aborted.
    return await Promise.race([run(), deadline]);
  } catch (error) {
    if (timedOut && !(error instanceof FetchRefusedError)) {
      throw new Error(`timed out after ${Math.round(options.timeoutMs / 1000)} s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
