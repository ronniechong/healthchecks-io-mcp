import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import { toToolError } from '../lib/tool-errors.js';
import type { ListChecksResponse, CheckSummary } from '../lib/types.js';

export function registerListChecks(server: McpServer, client: HealthchecksClient): void {
  server.registerTool(
    'list_checks',
    { description: 'List all Healthchecks.io checks on this account.' },
    async () => {
      const result = await client.getAllPages<ListChecksResponse, CheckSummary>(
        '/checks/',
        (data) => data.checks,
        (data) => data.next
      );
      if (!result.ok) return toToolError(result, 'list_checks failed');
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
