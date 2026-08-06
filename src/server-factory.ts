import { McpServer } from '@modelcontextprotocol/server';
import { HealthchecksClient, DEFAULT_BASE_URL } from './api-client.js';

export function createServer(): McpServer {
    return new McpServer(
        { name: 'healthchecks-io-mcp', version: '0.0.1' },
        { capabilities: { tools: {} } }
    );
}

export function createClient(apiKey: string, baseUrl: string = DEFAULT_BASE_URL): HealthchecksClient {
    return new HealthchecksClient({ apiKey, baseUrl });
}
