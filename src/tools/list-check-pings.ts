import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { ListPingsResponse, Ping } from '../lib/types.js';
import { resolveUuid, readOnlyBlockedResult } from './shared.js';

export function registerListCheckPings(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'list_check_pings',
    {
      description: 'List recent ping history for a check. Requires a read-write API key.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key.")
      }
    },
    async ({ check_id }) => {
      if (tier === 'read-only') return readOnlyBlockedResult('list_check_pings');

      const resolved = await resolveUuid(client, check_id, 'list_check_pings');
      if (!resolved.ok) return resolved.result;

      const result = await client.getAllPages<ListPingsResponse, Ping>(
        `/checks/${encodeURIComponent(resolved.uuid)}/pings/`,
        (data) => data.pings,
        (data) => data.next
      );
      if (!result.ok) return toToolError(result, `list_check_pings(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
