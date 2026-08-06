import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

export function createServer(): McpServer {
    return new McpServer(
        { name: 'healthchecks-io-mcp', version: '0.0.1' },
        { capabilities: { tools: {} } }
    );
}

async function main() {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
