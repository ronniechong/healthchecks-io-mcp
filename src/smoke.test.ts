import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('server boots over stdio and reports zero tools', async () => {
    const client = new Client({ name: 'smoke-test-client', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['dist/index.js']
    });

    await client.connect(transport);
    try {
        const { tools } = await client.listTools();
        assert.deepEqual(tools, []);
    } finally {
        await client.close();
    }
});
