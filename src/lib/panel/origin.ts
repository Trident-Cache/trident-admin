/**
 * Refuses state-changing requests that a browser reports as coming from
 * another site. Pure: reads four request headers and decides.
 *
 * Browsers set `Sec-Fetch-Site` and `Origin` themselves; a page cannot forge
 * either. A client that sends neither (curl, a script) is not a browser being
 * steered by a hostile page, and is let through.
 */

export type HeaderReader = (name: string) => string | null | undefined;

export type CrossSiteVerdict = { allowed: true } | { allowed: false; reason: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function firstValue(header: string | null | undefined): string {
  return (header ?? '').split(',')[0].trim();
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function crossSiteVerdict(method: string, header: HeaderReader): CrossSiteVerdict {
  if (isSafeMethod(method)) return { allowed: true };

  const fetchSite = (header('sec-fetch-site') ?? '').trim().toLowerCase();
  if (fetchSite === 'cross-site') {
    return { allowed: false, reason: 'the browser reported this request as cross-site (Sec-Fetch-Site: cross-site)' };
  }
  // The browser itself vouches that page and panel share an origin. This holds
  // even when a reverse proxy has rewritten Host, which the comparison below
  // could not tell apart from a foreign origin.
  if (fetchSite === 'same-origin') return { allowed: true };

  const origin = (header('origin') ?? '').trim();
  if (origin === '') return { allowed: true };

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    // "null" (a sandboxed frame, a data: page) and anything unparsable.
    return { allowed: false, reason: `the Origin header "${origin}" does not name this panel` };
  }

  const requestHost = firstValue(header('x-forwarded-host')) || firstValue(header('host'));
  let expectedHost: string;
  try {
    // Parsed under the origin's scheme so that an explicit default port
    // (example.com:443 for https) compares equal to its absence.
    expectedHost = new URL(`${originUrl.protocol}//${requestHost}`).host;
  } catch {
    return { allowed: false, reason: 'the request carries no usable Host header to compare its Origin with' };
  }
  if (requestHost === '' || originUrl.host !== expectedHost) {
    return {
      allowed: false,
      reason:
        `the Origin header names "${originUrl.host}" but the request was addressed to "${requestHost}". ` +
        'If a reverse proxy sits in front of the panel, make it pass the original Host header or set X-Forwarded-Host',
    };
  }
  return { allowed: true };
}
