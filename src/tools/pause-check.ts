import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';
import { confirmRequiredResult, readOnlyBlockedResult, resolveUuid } from './shared.js';

export function registerPauseCheck(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'pause_check',
    {
      description:
        'Pause monitoring for a check without deleting it. Silently disables alerting for this check until it resumes (on the next ping, unless manual_resume is set, or via resume_check) — can cause a missed incident if the underlying job is actually failing. Requires confirm: true and a read-write API key.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key."),
        confirm: z.boolean().optional().describe('Must be true to actually pause the check.')
      }
    },
    async ({ check_id, confirm }) => {
      if (tier === 'read-only') return readOnlyBlockedResult('pause_check');
      if (!confirm)
        return confirmRequiredResult('pause_check', check_id, 'pause monitoring for this check');

      const resolved = await resolveUuid(client, check_id, 'pause_check');
      if (!resolved.ok) return resolved.result;

      const result = await client.post<CheckSummary>(
        `/checks/${encodeURIComponent(resolved.uuid)}/pause`
      );
      if (!result.ok) return toToolError(result, `pause_check(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
