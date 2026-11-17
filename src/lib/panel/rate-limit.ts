/**
 * Counts failed sign-in attempts in memory: per client address, and across
 * all clients. Pure apart from the clock it is given.
 *
 * The total exists because the client address comes from X-Forwarded-For,
 * which a client that reaches the panel directly can set to anything; without
 * a total, rotating that header would reset the count on every attempt.
 */

export interface FailureLimiterOptions {
  /** Failures one client may make inside a window. */
  perClient: number;
  /** Failures all clients together may make inside a window. */
  total: number;
  windowMs: number;
  /** Upper bound on the number of clients remembered at once. */
  maxClients: number;
}

export const DEFAULT_LIMITS: FailureLimiterOptions = {
  perClient: 10,
  total: 100,
  windowMs: 5 * 60 * 1000,
  maxClients: 10_000,
};

interface Window {
  count: number;
  startedAt: number;
}

export class FailureLimiter {
  private readonly clients = new Map<string, Window>();
  private all: Window = { count: 0, startedAt: 0 };

  constructor(private readonly options: FailureLimiterOptions = DEFAULT_LIMITS) {}

  private live(window: Window | undefined, now: number): Window | undefined {
    return window && now - window.startedAt < this.options.windowMs ? window : undefined;
  }

  /** Seconds the client has to wait before another attempt is looked at; 0 when it may try now. */
  retryAfterSeconds(client: string, now: number): number {
    let waitMs = 0;
    const own = this.live(this.clients.get(client), now);
    if (own && own.count >= this.options.perClient) {
      waitMs = own.startedAt + this.options.windowMs - now;
    }
    const all = this.live(this.all, now);
    if (all && all.count >= this.options.total) {
      waitMs = Math.max(waitMs, all.startedAt + this.options.windowMs - now);
    }
    return waitMs > 0 ? Math.ceil(waitMs / 1000) : 0;
  }

  recordFailure(client: string, now: number): void {
    const all = this.live(this.all, now);
    if (all) all.count += 1;
    else this.all = { count: 1, startedAt: now };

    const own = this.live(this.clients.get(client), now);
    if (own) {
      own.count += 1;
      return;
    }
    if (this.clients.size >= this.options.maxClients) this.prune(now);
    // Still full after pruning: the total above is what bounds the attempts.
    if (this.clients.size >= this.options.maxClients) return;
    this.clients.set(client, { count: 1, startedAt: now });
  }

  /** A successful sign-in clears that client's count. The total is left alone. */
  recordSuccess(client: string): void {
    this.clients.delete(client);
  }

  private prune(now: number): void {
    for (const [client, window] of this.clients) {
      if (!this.live(window, now)) this.clients.delete(client);
    }
  }
}
