/**
 * Classification of IP addresses for outbound fetches the panel makes on a
 * caller's behalf. Pure: no I/O, no imports, so it can be tested on its own.
 *
 * Only `public` addresses may be fetched without the operator naming the host
 * in TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS.
 */

export type AddressClass =
  | 'public'
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'cgnat'
  | 'unspecified'
  | 'multicast'
  | 'reserved'
  | 'invalid';

/** Dotted decimal only. A leading zero is refused: some resolvers read it as octal. */
function parseIPv4(text: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (!match) return null;
  const octets: number[] = [];
  for (const part of match.slice(1)) {
    if (part.length > 1 && part.startsWith('0')) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/** Sixteen bytes, or null when the text is not an IPv6 address. Brackets and a zone id are accepted. */
function parseIPv6(text: string): number[] | null {
  let rest = text;
  if (rest.startsWith('[') && rest.endsWith(']')) rest = rest.slice(1, -1);
  const zone = rest.indexOf('%');
  if (zone !== -1) rest = rest.slice(0, zone);
  if (!rest.includes(':')) return null;

  // A dotted-decimal tail (::ffff:10.0.0.1) stands for the last two groups.
  let tail: number[] | null = null;
  if (rest.includes('.')) {
    const lastColon = rest.lastIndexOf(':');
    tail = parseIPv4(rest.slice(lastColon + 1));
    if (!tail) return null;
    rest = `${rest.slice(0, lastColon + 1)}0:0`;
  }

  const gap = rest.indexOf('::');
  if (gap !== rest.lastIndexOf('::')) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const group of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  let groups: number[];
  if (gap === -1) {
    const all = parseGroups(rest);
    if (!all || all.length !== 8) return null;
    groups = all;
  } else {
    const head = parseGroups(rest.slice(0, gap));
    const end = parseGroups(rest.slice(gap + 2));
    if (!head || !end || head.length + end.length > 7) return null;
    groups = [...head, ...new Array<number>(8 - head.length - end.length).fill(0), ...end];
  }

  const bytes: number[] = [];
  for (const group of groups) bytes.push(group >> 8, group & 0xff);
  if (tail) bytes.splice(12, 4, ...tail);
  return bytes;
}

function classifyIPv4(o: number[]): AddressClass {
  const [a, b, c] = o;
  if (a === 0) return 'unspecified'; // 0.0.0.0/8, "this network"
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local'; // includes 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return 'reserved'; // 240/4 and the broadcast address
  if (a === 192 && b === 0 && c === 0) return 'reserved'; // protocol assignments
  if (a === 192 && b === 0 && c === 2) return 'reserved'; // documentation
  if (a === 198 && b === 51 && c === 100) return 'reserved'; // documentation
  if (a === 203 && b === 0 && c === 113) return 'reserved'; // documentation
  if (a === 198 && (b === 18 || b === 19)) return 'reserved'; // benchmarking
  if (a === 192 && b === 88 && c === 99) return 'reserved'; // 6to4 relay anycast
  return 'public';
}

function classifyIPv6(b: number[]): AddressClass {
  const zeroUntil = (end: number) => b.slice(0, end).every((byte) => byte === 0);

  if (zeroUntil(15) && b[15] === 0) return 'unspecified';
  if (zeroUntil(15) && b[15] === 1) return 'loopback';

  // ::ffff:a.b.c.d reaches the IPv4 address it carries.
  if (zeroUntil(10) && b[10] === 0xff && b[11] === 0xff) return classifyIPv4(b.slice(12));
  // ::a.b.c.d (deprecated IPv4-compatible form).
  if (zeroUntil(12)) {
    const embedded = classifyIPv4(b.slice(12));
    return embedded === 'public' ? 'reserved' : embedded;
  }
  // 64:ff9b::/96, NAT64: a gateway forwards to the IPv4 address in the last four bytes.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every((x) => x === 0)) {
    return classifyIPv4(b.slice(12));
  }
  // 64:ff9b:1::/48, NAT64 for local use.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b[4] === 0x00 && b[5] === 0x01) {
    return 'reserved';
  }
  // 2002::/16, 6to4: the IPv4 address sits in bytes 2..5.
  if (b[0] === 0x20 && b[1] === 0x02) return classifyIPv4(b.slice(2, 6));

  if ((b[0] & 0xfe) === 0xfc) return 'private'; // fc00::/7, unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return 'link-local'; // fe80::/10
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return 'private'; // fec0::/10, old site-local
  if (b[0] === 0xff) return 'multicast';
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return 'reserved'; // documentation
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return 'reserved'; // Teredo
  if (b[0] === 0x01 && b[1] === 0x00 && b.slice(2, 8).every((x) => x === 0)) return 'reserved'; // discard-only

  // Global unicast is 2000::/3; nothing else is routable on the internet.
  return (b[0] & 0xe0) === 0x20 ? 'public' : 'reserved';
}

/** Classify one address written as text (IPv4 dotted decimal, or IPv6 with or without brackets). */
export function classifyAddress(address: string): AddressClass {
  const text = address.trim();
  const v4 = parseIPv4(text);
  if (v4) return classifyIPv4(v4);
  const v6 = parseIPv6(text);
  if (v6) return classifyIPv6(v6);
  return 'invalid';
}

/** True when the text is an IP address rather than a host name. */
export function isIpLiteral(host: string): boolean {
  return classifyAddress(host) !== 'invalid';
}

export interface AddressVerdict {
  ok: boolean;
  /** The first address that is not public, when `ok` is false. */
  address?: string;
  kind?: AddressClass;
}

/**
 * A host is fetchable only when every address it resolves to is public. One
 * private address among public ones is enough to refuse: which one the
 * connection would use is not something the caller of the panel should decide.
 */
export function checkAddresses(addresses: readonly string[]): AddressVerdict {
  if (addresses.length === 0) return { ok: false, kind: 'invalid' };
  for (const address of addresses) {
    const kind = classifyAddress(address);
    if (kind !== 'public') return { ok: false, address, kind };
  }
  return { ok: true };
}

/** Lower-case, without the brackets an IPv6 literal carries in a URL. */
export function normaliseHost(host: string): string {
  const lower = host.trim().toLowerCase();
  return lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
}

/** Parse TRIDENT_PANEL_SITEMAP_ALLOWED_HOSTS: comma-separated host names, matched exactly, case-insensitively. */
export function parseAllowedHosts(value: string | undefined): Set<string> {
  const hosts = new Set<string>();
  for (const entry of (value ?? '').split(',')) {
    const host = normaliseHost(entry);
    if (host) hosts.add(host);
  }
  return hosts;
}

const KIND_WORDS: Record<AddressClass, string> = {
  public: 'a public address',
  loopback: 'a loopback address',
  private: 'a private address',
  'link-local': 'a link-local address',
  cgnat: 'a carrier-grade NAT address',
  unspecified: 'the unspecified address',
  multicast: 'a multicast address',
  reserved: 'a reserved address',
  invalid: 'not a usable address',
};

export function describeAddressClass(kind: AddressClass): string {
  return KIND_WORDS[kind];
}
