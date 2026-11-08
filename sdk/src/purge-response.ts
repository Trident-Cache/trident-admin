import type { PurgeResponse } from './types';

const owns = (body: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(body, key);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function reportedCount(body: Record<string, unknown>): number {
  // request() already camel-cases the wire keys. A present native field is
  // authoritative, including zero or an invalid value; never fall back to a
  // conflicting legacy count.
  for (const key of ['purged', 'totalPurged', 'entriesRemoved', 'purgedCount']) {
    if (owns(body, key)) return count(body[key]) ? body[key] as number : 0;
  }
  return 0;
}

function purgeModeApplied(body: Record<string, unknown>): boolean {
  if (body.mode !== 'hard' && body.mode !== 'soft') return false;
  // Legacy responses returned only count and mode. Current engines return both state
  // and barrier. A deferred Reflect acknowledgement is not an applied purge.
  if (!owns(body, 'state') && !owns(body, 'barrier')) return true;
  return body.state === 'applied'
    && body.barrier === (body.mode === 'hard' ? 'delivery' : 'freshness');
}

function applied(body: Record<string, unknown>): boolean {
  if (owns(body, 'success') && body.success !== true) return false;
  if (owns(body, 'cleared') && body.cleared !== true) return false;
  if (body.error !== null && body.error !== undefined) return false;
  if (owns(body, 'state') && body.state !== 'applied') return false;

  if (owns(body, 'purged')) return count(body.purged) && purgeModeApplied(body);
  if (owns(body, 'totalPurged')) {
    if (!count(body.totalPurged) || !purgeModeApplied(body) || !Array.isArray(body.results)) return false;
    let total = 0;
    for (const result of body.results) {
      if (!object(result) || typeof result.url !== 'string' || !count(result.purged)
        || (result.error !== null && result.error !== undefined)) return false;
      total += result.purged;
    }
    return Number.isSafeInteger(total) && total === body.totalPurged;
  }
  if (owns(body, 'cleared')) return body.cleared === true && count(body.entriesRemoved) && count(body.bytesFreed);

  const nativeFields = ['entriesRemoved', 'results', 'state', 'barrier'];
  return !nativeFields.some(key => owns(body, key)) && body.success === true
    && (!owns(body, 'purgedCount') || count(body.purgedCount));
}

/** Normalize the three existing purge schemas after request() key conversion.
 * This is the typed applied result, not the durable delivery acknowledgement:
 * the latter also accepts Reflect's recorded HTTP 202 response.
 */
export function normalizePurgeResponse(value: unknown): PurgeResponse {
  const body = object(value) ? value : {};
  const message = typeof body.message !== 'string' && typeof body.error === 'string'
    ? { message: body.error } : {};
  return { ...body, ...message, success: applied(body), purgedCount: reportedCount(body) };
}
