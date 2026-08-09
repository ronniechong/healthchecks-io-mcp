import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';
import { readOnlyBlockedResult, resolveUuid } from './shared.js';

export function registerResumeCheck(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'resume_check',
    {
      description:
        'Resume monitoring for a paused check. Requires a read-write API key. Returns a conflict error if the check is not currently paused.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key.")
      }
    },
    async ({ check_id }) => {
      if (tier === 'read-only') return readOnlyBlockedResult('resume_check');

      const resolved = await resolveUuid(client, check_id, 'resume_check');
      if (!resolved.ok) return resolved.result;

      const result = await client.post<CheckSummary>(
        `/checks/${encodeURIComponent(resolved.uuid)}/resume`
      );
      if (!result.ok)
        return toToolError(
          result,
          `resume_check(${check_id}) failed — check may not currently be paused`
        );
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
