import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ApiResult } from './api-client.js';

type ApiFailure = Extract<ApiResult<unknown>, { ok: false }>;

export function toToolError(result: ApiFailure, context: string): CallToolResult {
  let text: string;
  switch (result.kind) {
    case 'unauthorized':
      text = `${context}: this endpoint requires a read-write Healthchecks.io API key. ${result.message}`;
      break;
    case 'not_found':
      text = `${context}: not found. Check the check ID and try again.`;
      break;
    case 'network':
      text = `${context}: network error — ${result.message}`;
      break;
    case 'unexpected':
      text = `${context}: ${result.message}`;
      break;
  }
  return { content: [{ type: 'text', text }], isError: true };
}
