import { McpServer } from '@modelcontextprotocol/server';
import { HealthchecksClient } from '../lib/api-client.js';
import { DEFAULT_BASE_URL } from '../config/constants.js';

export function createServer(): McpServer {
  return new McpServer(
    { name: 'healthchecks-io-mcp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );
}

export function createClient(
  apiKey: string,
  baseUrl: string = DEFAULT_BASE_URL
): HealthchecksClient {
  return new HealthchecksClient({ apiKey, baseUrl });
}
