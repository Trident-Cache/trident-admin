/**
 * The one decision point for every request the panel receives: is it allowed
 * through to a page or an API route, and if not, what is answered instead.
 *
 * `src/proxy.ts` hands each request to `PanelGate.handle` before any route
 * runs, so a route added later is covered without doing anything. The gate
 * also answers the three sign-in endpoints itself; they have no route files:
 *
 *   GET  /api/auth/session   { loginRequired, authenticated }
 *   POST /api/auth/login     { "password": "..." } -> sets the session cookie
 *   POST /api/auth/logout    revokes the session and clears the cookie
 *
 * Nothing here imports Next.js; the gate works on a small description of the
 * request so that it can be tested without a server.
 */
import type { PanelConfig } from './config';
import { crossSiteVerdict, isSafeMethod } from './origin';
import { DEFAULT_LIMITS, FailureLimiter } from './rate-limit';
import {
  SESSION_COOKIE,
  deriveSessionKey,
  issueSession,
  passwordMatches,
  randomSessionKey,
  verifySession,
} from './session';

/** Answers 200 with a fixed body to anyone: what a container health check should probe. */
export const LIVENESS_PATH = '/api/live';
export const LOGIN_PAGE = '/login';
export const SESSION_ENDPOINT = '/api/auth/session';
export const LOGIN_ENDPOINT = '/api/auth/login';
export const LOGOUT_ENDPOINT = '/api/auth/logout';

const STATIC_PREFIX = '/_next/static/';
const MAX_LOGIN_BODY_BYTES = 4096;

export interface GateRequest {
  method: string;
  /** Path without the base path, as Next.js reports it. */
  pathname: string;
  /** Query string including the leading "?", or "". */
  search: string;
  /** "" or the sub-path the panel is served under, without a trailing slash. */
  basePath: string;
  /** "https:" or "http:", as seen by the panel process itself. */
  protocol: string;
  header(name: string): string | null | undefined;
  cookie(name: string): string | undefined;
  /** The request body as text, or null when it is longer than `limit` bytes. */
  readBody(limit: number): Promise<string | null>;
}

export type GateResult =
  | { kind: 'continue' }
  | { kind: 'respond'; status: number; headers: Array<[string, string]>; body: string };

export interface GateOptions {
  now?: () => number;
  limiter?: FailureLimiter;
  /** Signing key; derived from the configuration when omitted. */
  key?: Buffer;
}

const CONTINUE: GateResult = { kind: 'continue' };

function json(status: number, body: unknown, extra: Array<[string, string]> = []): GateResult {
  return {
    kind: 'respond',
    status,
    headers: [
      ['Content-Type', 'application/json; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ...extra,
    ],
    body: JSON.stringify(body),
  };
}

function redirect(location: string): GateResult {
  return {
    kind: 'respond',
    status: 307,
    headers: [
      ['Location', location],
      ['Cache-Control', 'no-store'],
    ],
    body: '',
  };
}

function trimTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Build output only: hashed scripts, styles and fonts. Anything that could climb out of the folder is not it. */
function isStaticAsset(pathname: string): boolean {
  if (!pathname.startsWith(STATIC_PREFIX)) return false;
  return !/\.\.|\\|%2e|%2f|%5c/i.test(pathname);
}

/**
 * The address the nearest proxy saw the request come from: the last entry of
 * X-Forwarded-For. Next.js fills the header with the socket address when the
 * client sent none.
 */
export function clientAddress(header: GateRequest['header']): string {
  const entries = (header('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const last = entries[entries.length - 1] ?? '';
  return last ? last.slice(0, 64) : 'unknown';
}

function isHttps(request: GateRequest): boolean {
  const forwarded = (request.header('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  return forwarded ? forwarded === 'https' : request.protocol === 'https:';
}

export class PanelGate {
  private readonly now: () => number;
  private readonly limiter: FailureLimiter;
  private readonly key: Buffer;
  /** Session ids signed out before they expired, with their expiry time. */
  private readonly revoked = new Map<string, number>();

  constructor(
    readonly config: PanelConfig,
    options: GateOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.limiter = options.limiter ?? new FailureLimiter(DEFAULT_LIMITS);
    this.key =
      options.key ??
      (config.sessionSecret ? deriveSessionKey(config.sessionSecret, config.password) : randomSessionKey());
  }

  async handle(request: GateRequest): Promise<GateResult> {
    const pathname = trimTrailingSlash(request.pathname);
    const method = request.method.toUpperCase();

    if (this.config.errors.length > 0) {
      if (pathname === LIVENESS_PATH) return CONTINUE;
      return json(503, { error: 'The panel is misconfigured and is not serving requests. See its log.' });
    }

    const verdict = crossSiteVerdict(method, request.header);
    if (!verdict.allowed) {
      return json(403, { error: `Cross-site request refused: ${verdict.reason}.` });
    }

    if (pathname === SESSION_ENDPOINT) {
      if (!isSafeMethod(method)) return json(405, { error: 'Method not allowed' }, [['Allow', 'GET, HEAD']]);
      return json(200, {
        loginRequired: this.config.loginEnabled,
        authenticated: this.config.loginEnabled && this.authenticated(request),
      });
    }
    if (pathname === LOGIN_ENDPOINT) {
      if (method !== 'POST') return json(405, { error: 'Method not allowed' }, [['Allow', 'POST']]);
      return this.login(request);
    }
    if (pathname === LOGOUT_ENDPOINT) {
      if (method !== 'POST') return json(405, { error: 'Method not allowed' }, [['Allow', 'POST']]);
      return this.logout(request);
    }

    if (!this.config.loginEnabled) return CONTINUE;
    if (pathname === LIVENESS_PATH || isStaticAsset(pathname)) return CONTINUE;

    const authenticated = this.authenticated(request);
    if (pathname === LOGIN_PAGE) {
      return authenticated && isSafeMethod(method) ? redirect(`${request.basePath}/`) : CONTINUE;
    }
    if (authenticated) return CONTINUE;

    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    if (isApi || !isSafeMethod(method)) {
      return json(401, { error: 'Sign in to use the panel.', login: `${request.basePath}${LOGIN_PAGE}` });
    }
    return redirect(this.loginLocation(request, pathname));
  }

  private loginLocation(request: GateRequest, pathname: string): string {
    const params = new URLSearchParams(request.search);
    // Internal to client-side navigation; meaningless on the page it would return to.
    params.delete('_rsc');
    const query = params.toString();
    const target = `${pathname}${query ? `?${query}` : ''}`;
    const login = `${request.basePath}${LOGIN_PAGE}`;
    return target === '/' ? login : `${login}?next=${encodeURIComponent(target)}`;
  }

  private authenticated(request: GateRequest): boolean {
    const check = verifySession(request.cookie(SESSION_COOKIE), this.key, this.now(), this.config.sessionSeconds);
    return check.ok && !this.revoked.has(check.id);
  }

  private cookie(request: GateRequest, value: string, maxAgeSeconds: number): [string, string] {
    const attributes = [
      `${SESSION_COOKIE}=${value}`,
      `Path=${request.basePath || '/'}`,
      `Max-Age=${maxAgeSeconds}`,
      'HttpOnly',
      'SameSite=Strict',
    ];
    if (isHttps(request)) attributes.push('Secure');
    return ['Set-Cookie', attributes.join('; ')];
  }

  private async login(request: GateRequest): Promise<GateResult> {
    if (!this.config.loginEnabled) {
      return json(404, { error: 'This panel has no login: TRIDENT_PANEL_PASSWORD is not set.' });
    }

    const client = clientAddress(request.header);
    const wait = this.limiter.retryAfterSeconds(client, this.now());
    if (wait > 0) {
      return json(429, { error: `Too many failed sign-in attempts. Try again in ${wait} seconds.` }, [
        ['Retry-After', String(wait)],
      ]);
    }

    const body = await request.readBody(MAX_LOGIN_BODY_BYTES);
    let password: unknown;
    try {
      password = body === null ? undefined : (JSON.parse(body) as { password?: unknown })?.password;
    } catch {
      password = undefined;
    }
    if (typeof password !== 'string') {
      return json(400, { error: 'Send a JSON body of the form {"password": "..."}.' });
    }

    if (!passwordMatches(password, this.config.password)) {
      this.limiter.recordFailure(client, this.now());
      return json(401, { error: 'Wrong password.' });
    }

    this.limiter.recordSuccess(client);
    const session = issueSession(this.key, this.now(), this.config.sessionSeconds);
    return json(200, { ok: true, expiresAt: new Date(session.expiresAt).toISOString() }, [
      this.cookie(request, session.token, this.config.sessionSeconds),
    ]);
  }

  private logout(request: GateRequest): GateResult {
    const now = this.now();
    for (const [id, expiresAt] of this.revoked) {
      if (expiresAt <= now) this.revoked.delete(id);
    }
    if (this.config.loginEnabled) {
      const check = verifySession(request.cookie(SESSION_COOKIE), this.key, now, this.config.sessionSeconds);
      if (check.ok) this.revoked.set(check.id, check.expiresAt);
    }
    return json(200, { ok: true }, [this.cookie(request, '', 0)]);
  }
}
