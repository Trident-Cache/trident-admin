/**
 * Session tokens for the panel's login: a signed expiry time, nothing else.
 *
 *   v1.<expiry, seconds since the epoch, base 36>.<random id>.<HMAC-SHA-256>
 *
 * The signature covers everything before it. There is no server-side session
 * table; the id exists so that signing out can revoke one token.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'trident_panel_session';

const VERSION = 'v1';
const ID_BYTES = 16;
// A token may outlive the configured lifetime by this much before it is
// refused as issued under a longer lifetime than the current one.
const LIFETIME_SLACK_SECONDS = 60;

export interface IssuedSession {
  token: string;
  id: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
}

export type SessionCheck =
  | { ok: true; id: string; expiresAt: number }
  | { ok: false; reason: 'missing' | 'malformed' | 'signature' | 'expired' };

/** A key for this process only: sessions signed with it end when the process does. */
export function randomSessionKey(): Buffer {
  return randomBytes(32);
}

/**
 * The key for a configured secret. The password is mixed in so that changing
 * the password ends every session signed under the old one.
 */
export function deriveSessionKey(secret: string, password: string): Buffer {
  return createHmac('sha256', secret).update('trident-panel-session-key\n').update(password).digest();
}

function sign(key: Buffer, payload: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function issueSession(key: Buffer, nowMs: number, lifetimeSeconds: number): IssuedSession {
  const expirySeconds = Math.floor(nowMs / 1000) + lifetimeSeconds;
  const id = randomBytes(ID_BYTES).toString('base64url');
  const payload = `${VERSION}.${expirySeconds.toString(36)}.${id}`;
  return { token: `${payload}.${sign(key, payload)}`, id, expiresAt: expirySeconds * 1000 };
}

export function verifySession(
  token: string | undefined | null,
  key: Buffer,
  nowMs: number,
  lifetimeSeconds: number,
): SessionCheck {
  if (!token) return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [version, expiryText, id, signature] = parts;
  if (version !== VERSION || !/^[0-9a-z]{1,11}$/.test(expiryText) || !/^[A-Za-z0-9_-]{22}$/.test(id)) {
    return { ok: false, reason: 'malformed' };
  }

  const expected = Buffer.from(sign(key, `${version}.${expiryText}.${id}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'signature' };
  }

  const expirySeconds = parseInt(expiryText, 36);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (expirySeconds <= nowSeconds) return { ok: false, reason: 'expired' };
  if (expirySeconds - nowSeconds > lifetimeSeconds + LIFETIME_SLACK_SECONDS) return { ok: false, reason: 'expired' };
  return { ok: true, id, expiresAt: expirySeconds * 1000 };
}

/** Compare a submitted password with the configured one without leaking where, or whether, they differ. */
export function passwordMatches(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}
