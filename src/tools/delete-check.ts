import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';
import { confirmRequiredResult, readOnlyBlockedResult, resolveUuid } from './shared.js';

export function registerDeleteCheck(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'delete_check',
    {
      description:
        'Permanently delete a check. This cannot be undone. Requires confirm: true and a read-write API key.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key."),
        confirm: z.boolean().optional().describe('Must be true to actually delete the check.')
      }
    },
    async ({ check_id, confirm }) => {
      if (tier === 'read-only') return readOnlyBlockedResult('delete_check');
      if (!confirm)
        return confirmRequiredResult('delete_check', check_id, 'permanently delete this check');

      const resolved = await resolveUuid(client, check_id, 'delete_check');
      if (!resolved.ok) return resolved.result;

      const result = await client.del<CheckSummary>(`/checks/${encodeURIComponent(resolved.uuid)}`);
      if (!result.ok) return toToolError(result, `delete_check(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
