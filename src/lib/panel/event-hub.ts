/**
 * One upstream event stream per kind, shared by every browser tab that
 * watches it.
 *
 * Trident's admin API limits connections per client address, and to Trident
 * the panel is a single client. A stream opened per tab therefore runs out
 * after a handful of tabs. The hub opens the upstream stream of a kind when
 * its first tab subscribes, copies each event to every subscriber, and closes
 * the upstream stream when the last one leaves.
 *
 * Nothing here knows about HTTP: the caller supplies the function that opens
 * the upstream stream, and each subscriber is two callbacks.
 */

export interface UpstreamHandlers {
  onData(chunk: Uint8Array): void;
  /**
   * The stream is over. `status` is set when the upstream answered with
   * something other than 200, `failed` when it could not be reached at all.
   */
  onClose(outcome: { status?: number; failed?: boolean }): void;
}

export interface UpstreamConnection {
  close(): void;
}

export type OpenUpstream = (kind: string, handlers: UpstreamHandlers) => UpstreamConnection;

export interface Subscriber {
  /** Deliver one complete event. Return false when the subscriber cannot keep up and should be dropped. */
  send(event: Uint8Array): boolean;
  /** The stream ended; the subscriber should end its own response. */
  close(): void;
}

interface Channel {
  upstream: UpstreamConnection | null;
  subscribers: Set<Subscriber>;
  /** Bytes received after the last complete event. */
  partial: Buffer;
  /** The upstream's greeting, replayed to subscribers that join later. */
  greeting: Uint8Array | null;
  closed: boolean;
}

// An event is never this large; a stream that sends this much without ending
// an event is not an event stream.
const MAX_PARTIAL_BYTES = 4 * 1024 * 1024;

const encoder = new TextEncoder();

function errorEvent(message: string): Uint8Array {
  return encoder.encode(`event: error\ndata: ${message}\n\n`);
}

/** Index just past the first blank line (the end of an event), or -1. */
function endOfEvent(buffer: Buffer): number {
  for (let i = 0; i < buffer.length - 1; i++) {
    const byte = buffer[i];
    if (byte !== 0x0a && byte !== 0x0d) continue;
    // After one line ending, a second one ends the event: \n\n, \r\r, \r\n\r\n.
    let next = i + 1;
    if (byte === 0x0d && buffer[next] === 0x0a) next += 1;
    if (next >= buffer.length) return -1;
    if (buffer[next] === 0x0a) return next + 1;
    if (buffer[next] === 0x0d) {
      // A lone \r at the very end may be the first half of \r\n; wait for more.
      if (next + 1 >= buffer.length) return -1;
      return buffer[next + 1] === 0x0a ? next + 2 : next + 1;
    }
  }
  return -1;
}

function isGreeting(event: Buffer): boolean {
  return /^event:[ ]?connected[ \t]*$/m.test(event.toString('utf8'));
}

export class EventHub {
  private readonly channels = new Map<string, Channel>();

  constructor(private readonly openUpstream: OpenUpstream) {}

  /** Number of subscribers per kind that currently has an upstream stream. */
  snapshot(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [kind, channel] of this.channels) counts[kind] = channel.subscribers.size;
    return counts;
  }

  /** Start receiving the events of `kind`. Returns the function that stops it. */
  subscribe(kind: string, subscriber: Subscriber): () => void {
    let channel = this.channels.get(kind);
    if (channel) {
      channel.subscribers.add(subscriber);
      if (channel.greeting && !subscriber.send(channel.greeting)) {
        this.drop(kind, channel, subscriber);
      }
    } else {
      channel = { upstream: null, subscribers: new Set([subscriber]), partial: Buffer.alloc(0), greeting: null, closed: false };
      this.channels.set(kind, channel);
      this.connect(kind, channel);
    }

    const joined = channel;
    return () => {
      if (!joined.subscribers.delete(subscriber)) return;
      if (joined.subscribers.size === 0) this.shut(kind, joined);
    };
  }

  private connect(kind: string, channel: Channel): void {
    const upstream = this.openUpstream(kind, {
      onData: (chunk) => {
        if (channel.closed) return;
        channel.partial = channel.partial.length === 0 ? Buffer.from(chunk) : Buffer.concat([channel.partial, chunk]);
        for (let end = endOfEvent(channel.partial); end !== -1; end = endOfEvent(channel.partial)) {
          const raw = channel.partial.subarray(0, end);
          channel.partial = channel.partial.subarray(end);
          // A copy: `raw` shares memory with a buffer that is about to be reused.
          const event = Uint8Array.from(raw);
          if (isGreeting(raw)) channel.greeting = event;
          this.broadcast(kind, channel, event);
          if (channel.closed) return;
        }
        if (channel.partial.length > MAX_PARTIAL_BYTES) this.end(kind, channel, errorEvent('upstream sent malformed data'));
      },
      onClose: (outcome) => {
        if (channel.closed) return;
        if (outcome.status !== undefined) this.end(kind, channel, errorEvent(`upstream ${outcome.status}`));
        else if (outcome.failed) this.end(kind, channel, errorEvent('connection failed'));
        else this.end(kind, channel, null);
      },
    });
    // The channel may have been shut from inside openUpstream's callbacks.
    if (channel.closed) upstream.close();
    else channel.upstream = upstream;
  }

  private broadcast(kind: string, channel: Channel, event: Uint8Array): void {
    for (const subscriber of [...channel.subscribers]) {
      let delivered = false;
      try {
        delivered = subscriber.send(event);
      } catch {
        delivered = false;
      }
      if (!delivered) this.drop(kind, channel, subscriber);
    }
  }

  /** Remove one subscriber that cannot be written to, and tell it so. */
  private drop(kind: string, channel: Channel, subscriber: Subscriber): void {
    if (!channel.subscribers.delete(subscriber)) return;
    try {
      subscriber.close();
    } catch {
      // Already gone.
    }
    if (channel.subscribers.size === 0) this.shut(kind, channel);
  }

  /** The upstream stream is over: pass on a last event, if any, and end every subscriber. */
  private end(kind: string, channel: Channel, last: Uint8Array | null): void {
    const subscribers = [...channel.subscribers];
    channel.subscribers.clear();
    this.shut(kind, channel);
    for (const subscriber of subscribers) {
      try {
        if (last) subscriber.send(last);
        subscriber.close();
      } catch {
        // Already gone.
      }
    }
  }

  /** Close the upstream stream and forget the channel. */
  private shut(kind: string, channel: Channel): void {
    if (channel.closed) return;
    channel.closed = true;
    if (this.channels.get(kind) === channel) this.channels.delete(kind);
    channel.upstream?.close();
  }
}
