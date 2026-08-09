import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

/**
 * Minimal stand-in for the real Healthchecks.io API, used only so this
 * subprocess test doesn't depend on live network access or real
 * credentials, via the same HEALTHCHECKS_BASE_URL a self-hosted user
 * would set (see index.ts).
 */
async function startMockHcServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/channels/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      return;
    }
    if (req.url === '/checks/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ checks: [] }));
      return;
    }
    if (req.url === '/checks/' && req.method === 'POST') {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({ name: 'smoke-test-check', uuid: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' })
      );
      return;
    }
    if (req.url === '/badges/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ badges: { '*': { svg: 'https://example.com/badge.svg' } } }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<html>Not Found</html>');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Failed to bind mock server');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

test('server boots over stdio, detects tier, registers all 11 tools, and can call v2/v3 tools', async () => {
  const mock = await startMockHcServer();
  const client = new Client({ name: 'smoke-test-client', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { ...process.env, HEALTHCHECKS_API_KEY: 'fake-test-key', HEALTHCHECKS_BASE_URL: mock.url }
  });

  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'create_check',
      'delete_check',
      'get_check',
      'list_badges',
      'list_check_flips',
      'list_check_pings',
      'list_checks',
      'list_integrations',
      'pause_check',
      'resume_check',
      'update_check'
    ]);

    const result = await client.callTool({ name: 'list_checks', arguments: {} });
    assert.equal(result.isError, undefined);

    const created = await client.callTool({
      name: 'create_check',
      arguments: { name: 'smoke-test-check' }
    });
    assert.equal(created.isError, undefined);

    const badges = await client.callTool({ name: 'list_badges', arguments: {} });
    assert.equal(badges.isError, undefined);
  } finally {
    await client.close();
    await mock.close();
  }
});
