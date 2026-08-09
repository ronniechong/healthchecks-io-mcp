import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';
import { checkInputFields, readOnlyBlockedResult } from './shared.js';

export function registerCreateCheck(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'create_check',
    {
      description:
        'Create a new Healthchecks.io check (or upsert an existing one if `unique` fields are given and match). Requires a read-write API key.',
      inputSchema: checkInputFields()
    },
    async (input) => {
      if (tier === 'read-only') return readOnlyBlockedResult('create_check');

      const result = await client.post<CheckSummary>('/checks/', input);
      if (!result.ok) return toToolError(result, 'create_check failed');
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
