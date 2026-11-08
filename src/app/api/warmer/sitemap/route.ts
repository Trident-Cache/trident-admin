import { NextResponse } from 'next/server';
import { trident, TridentError } from '@/lib/trident';

export const dynamic = 'force-dynamic';

// Guards so a single sitemap submission can't fan out unbounded.
const MAX_CHILD_SITEMAPS = 50;
const MAX_URLS = 50_000;
const FETCH_TIMEOUT_MS = 15_000;

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

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'Trident-Admin/sitemap-warmer', Accept: 'application/xml,text/xml,*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
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
      return NextResponse.json(
        { error: `Could not fetch sitemap: ${e instanceof Error ? e.message : 'unreachable'}` },
        { status: 502 }
      );
    }

    const isIndex = /<sitemapindex[\s>]/i.test(root);
    let urls: string[] = [];
    let sitemapsFetched = 1;

    if (isIndex) {
      const children = extractLocs(root).slice(0, MAX_CHILD_SITEMAPS);
      for (const child of children) {
        try {
          urls.push(...extractLocs(await fetchText(child)));
          sitemapsFetched++;
        } catch {
          // A broken child sitemap is skipped, not fatal.
        }
        if (urls.length >= MAX_URLS) break;
      }
    } else {
      urls = extractLocs(root);
    }

    urls = Array.from(new Set(urls)).slice(0, MAX_URLS);
    if (urls.length === 0) {
      return NextResponse.json({ error: 'No <loc> URLs found in the sitemap' }, { status: 422 });
    }

    const res = await trident.warmerQueue(urls);
    return NextResponse.json({
      sitemap: sitemapUrl,
      index: isIndex,
      sitemapsFetched,
      urls: urls.length,
      queued: res?.received ?? urls.length,
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
