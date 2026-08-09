import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import { toToolError } from '../lib/tool-errors.js';
import type { BadgesResponse } from '../lib/types.js';

export function registerListBadges(server: McpServer, client: HealthchecksClient): void {
  server.registerTool(
    'list_badges',
    {
      description:
        'List badge URLs (SVG, JSON, Shields.io) for every tag in the project, plus an overall "*" badge. Works with either key tier.'
    },
    async () => {
      const result = await client.get<BadgesResponse>('/badges/');
      if (!result.ok) return toToolError(result, 'list_badges failed');
      return { content: [{ type: 'text', text: JSON.stringify(result.data.badges, null, 2) }] };
    }
  );
}
