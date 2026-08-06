import type { CallToolResult } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { CheckSummary } from '../lib/types.js';
import { toToolError } from '../lib/tool-errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The /pings/ endpoint only accepts a check's uuid, not its unique_key —
 * confirmed live in M03 (contrary to M01's assumption, which only tested
 * unique_key against the blocked read-only-key case, where either
 * identifier 401s identically). Resolve unique_key -> uuid via get_check
 * first so callers can pass either identifier, matching every other tool.
 */
export async function resolveUuid(
  client: HealthchecksClient,
  checkId: string
): Promise<{ ok: true; uuid: string } | { ok: false; result: CallToolResult }> {
  if (UUID_PATTERN.test(checkId)) return { ok: true, uuid: checkId };

  const lookup = await client.get<CheckSummary>(`/checks/${encodeURIComponent(checkId)}`);
  if (!lookup.ok) {
    return {
      ok: false,
      result: toToolError(lookup, `list_check_pings(${checkId}) failed to resolve check`)
    };
  }
  if (!lookup.data.uuid) {
    return {
      ok: false,
      result: {
        content: [
          {
            type: 'text',
            text: `list_check_pings(${checkId}): could not resolve a uuid for this check from the current API key's response.`
          }
        ],
        isError: true
      }
    };
  }
  return { ok: true, uuid: lookup.data.uuid };
}

export function readOnlyBlockedResult(toolName: string): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${toolName} requires a read-write Healthchecks.io API key. This server detected a read-only key when it connected.`
      }
    ],
    isError: true as const
  };
}
