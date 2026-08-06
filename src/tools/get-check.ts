import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import { toToolError } from '../lib/tool-errors.js';
import type { CheckSummary } from '../lib/types.js';

export function registerGetCheck(server: McpServer, client: HealthchecksClient): void {
  server.registerTool(
    'get_check',
    {
      description: 'Get details for a single Healthchecks.io check by its UUID or unique key.',
      inputSchema: {
        check_id: z.string().describe("The check's UUID or unique_key.")
      }
    },
    async ({ check_id }) => {
      const result = await client.get<CheckSummary>(`/checks/${encodeURIComponent(check_id)}`);
      if (!result.ok) return toToolError(result, `get_check(${check_id}) failed`);
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
