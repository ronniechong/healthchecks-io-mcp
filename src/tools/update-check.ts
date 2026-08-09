import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';
import { checkInputFields, readOnlyBlockedResult, resolveUuid } from './shared.js';

export function registerUpdateCheck(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  const { unique: _unique, ...updateFields } = checkInputFields();

  server.registerTool(
    'update_check',
    {
      description:
        'Update an existing Healthchecks.io check. This is a PARTIAL update: any field you omit is left unchanged, not cleared or reset to a default. Requires a read-write API key.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key."),
        ...updateFields
      }
    },
    async ({ check_id, ...fields }) => {
      if (tier === 'read-only') return readOnlyBlockedResult('update_check');

      const resolved = await resolveUuid(client, check_id, 'update_check');
      if (!resolved.ok) return resolved.result;

      const result = await client.post<CheckSummary>(
        `/checks/${encodeURIComponent(resolved.uuid)}`,
        fields
      );
      if (!result.ok) return toToolError(result, `update_check(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
