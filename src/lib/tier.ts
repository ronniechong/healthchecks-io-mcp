import type { HealthchecksClient } from './api-client.js';

export type KeyTier = 'read-write' | 'read-only';

/**
 * Prefix hint only — undocumented by Healthchecks.io, never authoritative.
 * Use detectKeyTier() for the real answer.
 */
export function prefixHint(apiKey: string): KeyTier | 'unknown' {
  if (apiKey.startsWith('hcw_')) return 'read-write';
  if (apiKey.startsWith('hcr_')) return 'read-only';
  return 'unknown';
}

/**
 * Authoritative one-time tier probe (decision #10): GET /channels/ succeeds
 * (200) only for a read-write key, and fails (401) for a read-only key.
 */
export async function detectKeyTier(client: HealthchecksClient): Promise<KeyTier> {
  const result = await client.get<unknown>('/channels/');
  if (result.ok) return 'read-write';
  if (result.kind === 'unauthorized') return 'read-only';
  throw new Error(`Could not determine Healthchecks.io API key tier: ${result.message}`);
}
