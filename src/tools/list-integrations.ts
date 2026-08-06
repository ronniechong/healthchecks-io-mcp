import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { toToolError } from '../lib/tool-errors.js';
import type { ListChannelsResponse } from '../lib/types.js';
import { readOnlyBlockedResult } from './shared.js';

export function registerListIntegrations(
  server: McpServer,
  client: HealthchecksClient,
  tier: KeyTier
): void {
  server.registerTool(
    'list_integrations',
    {
      description:
        'List configured notification integrations (channels). Requires a read-write API key.'
    },
    async () => {
      if (tier === 'read-only') return readOnlyBlockedResult('list_integrations');
      const result = await client.get<ListChannelsResponse>('/channels/');
      if (!result.ok) return toToolError(result, 'list_integrations failed');
      return { content: [{ type: 'text', text: JSON.stringify(result.data.channels, null, 2) }] };
    }
  );
}
