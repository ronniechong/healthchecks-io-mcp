import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../server/server-factory.js';
import { HealthchecksClient } from '../lib/api-client.js';
import { registerTools } from './index.js';
import type { KeyTier } from '../lib/tier.js';

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

async function connectedClient(tier: KeyTier, fetchImpl: typeof fetch) {
  mock.method(globalThis, 'fetch', fetchImpl);
  const apiClient = new HealthchecksClient({ apiKey: 'test-key' });
  const server = createServer();
  registerTools(server, apiClient, tier);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-harness', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

test('list_checks returns the checks array, including an empty account', async () => {
  const client = await connectedClient('read-write', (async () =>
    jsonResponse({ checks: [] })) as typeof fetch);
  try {
    const result = await client.callTool({ name: 'list_checks', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), []);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('get_check on an invalid id returns a clean tool error, not a crash', async () => {
  const client = await connectedClient(
    'read-write',
    (async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
      })) as typeof fetch
  );
  try {
    const result = await client.callTool({ name: 'get_check', arguments: { check_id: 'nope' } });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /not found/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_pings degrades cleanly on a read-only key, without calling the API', async () => {
  let called = false;
  const client = await connectedClient('read-only', (async () => {
    called = true;
    return jsonResponse({});
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'list_check_pings',
      arguments: { check_id: 'abc' }
    });
    assert.equal(result.isError, true);
    assert.match(
      (result.content as Array<{ text: string }>)[0].text,
      /read-write Healthchecks\.io API key/
    );
    assert.equal(called, false);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_integrations degrades cleanly on a read-only key', async () => {
  const client = await connectedClient('read-only', (async () => jsonResponse({})) as typeof fetch);
  try {
    const result = await client.callTool({ name: 'list_integrations', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(
      (result.content as Array<{ text: string }>)[0].text,
      /read-write Healthchecks\.io API key/
    );
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_pings resolves a unique_key to a uuid before calling /pings/ (real HC.io behavior)', async () => {
  const calledUrls: string[] = [];
  const client = await connectedClient('read-write', (async (url: string) => {
    calledUrls.push(String(url));
    if (String(url).endsWith('/pings/')) {
      assert.match(String(url), /real-uuid-1234/);
      return jsonResponse({ pings: [{ type: 'success' }] });
    }
    return jsonResponse({ name: 'x', unique_key: 'the-unique-key', uuid: 'real-uuid-1234' });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'list_check_pings',
      arguments: { check_id: 'the-unique-key' }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), [
      { type: 'success' }
    ]);
    assert.equal(calledUrls.length, 2);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_pings calls /pings/ directly when check_id already looks like a uuid', async () => {
  const calledUrls: string[] = [];
  const client = await connectedClient('read-write', (async (url: string) => {
    calledUrls.push(String(url));
    return jsonResponse({ pings: [] });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'list_check_pings',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' }
    });
    assert.equal(result.isError, undefined);
    assert.equal(calledUrls.length, 1);
  } finally {
    mock.reset();
    await client.close();
  }
});
