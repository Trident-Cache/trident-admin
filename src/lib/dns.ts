import type { DiscoveryRefreshResponse } from '@trident-cache/sdk';

/** The native refresh response reports current addresses, not a change flag. */
export function dnsRefreshMessage(name: string, response: DiscoveryRefreshResponse): string {
  if (response.success !== true) throw new Error(response.error || `failed to refresh ${name}`);
  if (!Array.isArray(response.addresses)) throw new Error('Invalid DNS refresh response');
  return `${name} re-resolved (${response.addresses.length} address(es)).`;
}
