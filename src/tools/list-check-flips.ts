import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import { toToolError } from '../lib/tool-errors.js';
import type { ListFlipsResponse } from '../lib/types.js';

export function registerListCheckFlips(server: McpServer, client: HealthchecksClient): void {
  server.registerTool(
    'list_check_flips',
    {
      description:
        'List status-change history ("flips", e.g. down->up) for a check. Works with either key tier.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key."),
        seconds: z.number().optional().describe('Only return flips from the last N seconds.'),
        start: z
          .number()
          .optional()
          .describe('Unix timestamp: only return flips at or after this time.'),
        end: z
          .number()
          .optional()
          .describe('Unix timestamp: only return flips at or before this time.')
      }
    },
    async ({ check_id, seconds, start, end }) => {
      const params = new URLSearchParams();
      if (seconds !== undefined) params.set('seconds', String(seconds));
      if (start !== undefined) params.set('start', String(start));
      if (end !== undefined) params.set('end', String(end));
      const query = params.toString();

      const result = await client.get<ListFlipsResponse>(
        `/checks/${encodeURIComponent(check_id)}/flips/${query ? `?${query}` : ''}`
      );
      if (!result.ok) return toToolError(result, `list_check_flips(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data.flips, null, 2) }] };
    }
  );
}
