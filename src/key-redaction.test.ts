import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const FAKE_KEY = 'hcw_test_secret_value_should_never_leak';

async function startMockHcServer(): Promise<{ url: string; close: () => Promise<void> }> {
    const server = http.createServer((req, res) => {
        if (req.url === '/channels/') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('[]');
            return;
        }
        // Everything else 404s (HTML body), to induce a real error path.
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('<html>Not Found</html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Failed to bind mock server');
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve) => server.close(() => resolve()))
    };
}

test('the API key never appears in stdout or stderr, including on an induced error path', async () => {
    const mock = await startMockHcServer();
    let stderrOutput = '';

    const client = new Client({ name: 'redaction-test-client', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['dist/index.js'],
        env: { ...process.env, HEALTHCHECKS_API_KEY: FAKE_KEY, HEALTHCHECKS_BASE_URL: mock.url },
        stderr: 'pipe'
    });

    transport.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString();
    });

    await client.connect(transport);
    try {
        // Induce a real error path (mock server 404s everything but /channels/).
        const result = await client.callTool({ name: 'get_check', arguments: { check_id: 'does-not-exist' } });
        assert.equal(result.isError, true);

        const stdoutFromToolResult = JSON.stringify(result);
        assert.doesNotMatch(stdoutFromToolResult, new RegExp(FAKE_KEY));
        assert.doesNotMatch(stderrOutput, new RegExp(FAKE_KEY));
    } finally {
        await client.close();
        await mock.close();
    }
});
