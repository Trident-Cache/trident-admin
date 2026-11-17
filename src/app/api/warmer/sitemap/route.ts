import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';
import { parseAllowedHosts } from '@/lib/panel/address';
import { ALLOWED_HOSTS_ENV, FetchRefusedError, guardedFetchText } from '@/lib/panel/guarded-fetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Guards so a single sitemap submission can't fan out unbounded.
const MAX_CHILD_SITEMAPS = 50;
const MAX_URLS = 50_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 5;
// Refusals are reported back so the operator learns which host to allow; a
// sitemap index can name many children, so only the first few are listed.
const MAX_REPORTED_REFUSALS = 10;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

/** Extract and clean every <loc>…</loc> value from a sitemap document. */
function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const url = decodeEntities(m[1].trim());
    if (url) out.push(url);
  }
  return out;
}

/**
 * Fetch one sitemap document. The URL comes from the caller (or from a sitemap
 * the caller pointed at), so it is fetched under the rules of
 * `guardedFetchText`: http(s) only, no host that resolves to a loopback,
 * private, link-local or otherwise non-public address unless the operator
 * listed it in TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS, and the same check again
 * after every redirect.
 */
async function fetchText(url: string): Promise<string> {
  return guardedFetchText(url, {
    allowedHosts: parseAllowedHosts(process.env[ALLOWED_HOSTS_ENV]),
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_SITEMAP_BYTES,
    maxRedirects: MAX_REDIRECTS,
    headers: { 'User-Agent': 'Trident-Admin/sitemap-warmer', Accept: 'application/xml,text/xml,*/*' },
  });
}

/**
 * POST { url } — fetch a sitemap (or sitemap index), expand it to the contained
 * page URLs, and queue them on Trident's cache warmer. Unlike the raw
 * /api/warmer/queue (which takes literal URLs), this parses the XML so the
 * operator can warm an entire site from its sitemap.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sitemapUrl: string = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!sitemapUrl) {
      return NextResponse.json({ error: 'A sitemap URL is required' }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(sitemapUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid sitemap URL' }, { status: 400 });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Sitemap URL must be http(s)' }, { status: 400 });
    }

    let root: string;
    try {
      root = await fetchText(sitemapUrl);
    } catch (e) {
      if (e instanceof FetchRefusedError) {
        return NextResponse.json({ error: e.message, refusedHost: e.host }, { status: 400 });
      }
      return NextResponse.json(
        { error: `Could not fetch sitemap: ${e instanceof Error ? e.message : 'unreachable'}` },
        { status: 502 }
      );
    }

    const isIndex = /<sitemapindex[\s>]/i.test(root);
    let urls: string[] = [];
    let sitemapsFetched = 1;
    const refused: string[] = [];

    if (isIndex) {
      const children = extractLocs(root).slice(0, MAX_CHILD_SITEMAPS);
      for (const child of children) {
        try {
          urls.push(...extractLocs(await fetchText(child)));
          sitemapsFetched++;
        } catch (e) {
          // A broken child sitemap is skipped, not fatal. One that was refused
          // is skipped too, and reported.
          if (e instanceof FetchRefusedError && refused.length < MAX_REPORTED_REFUSALS && !refused.includes(e.message)) {
            refused.push(e.message);
          }
        }
        if (urls.length >= MAX_URLS) break;
      }
    } else {
      urls = extractLocs(root);
    }

    urls = Array.from(new Set(urls)).slice(0, MAX_URLS);
    if (urls.length === 0) {
      return NextResponse.json(
        {
          error: refused.length > 0 ? `No <loc> URLs found in the sitemap. ${refused[0]}` : 'No <loc> URLs found in the sitemap',
          ...(refused.length > 0 ? { refused } : {}),
        },
        { status: 422 }
      );
    }

    const res = await trident.warmerQueue(urls);
    return NextResponse.json({
      sitemap: sitemapUrl,
      index: isIndex,
      sitemapsFetched,
      urls: urls.length,
      queued: res?.received ?? urls.length,
      ...(refused.length > 0 ? { refused } : {}),
    });
  } catch (err) {
    if (err instanceof TridentError) {
      return NextResponse.json({ error: err.message, code: err.statusCode }, { status: err.statusCode || 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process sitemap' },
      { status: 500 }
    );
  }
}
