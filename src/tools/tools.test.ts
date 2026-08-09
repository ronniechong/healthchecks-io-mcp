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

// --- v2 mutating tools ---

test('create_check is blocked on a read-only key', async () => {
  const client = await connectedClient('read-only', (async () => jsonResponse({})) as typeof fetch);
  try {
    const result = await client.callTool({ name: 'create_check', arguments: { name: 'x' } });
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

test('create_check posts a Simple (timeout) check', async () => {
  const bodies: unknown[] = [];
  const client = await connectedClient('read-write', (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse((init?.body as string) ?? '{}'));
    return jsonResponse({ name: 'simple', uuid: 'x' }, 201);
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'create_check',
      arguments: { name: 'simple', timeout: 3600 }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(bodies[0], { name: 'simple', timeout: 3600 });
  } finally {
    mock.reset();
    await client.close();
  }
});

test('create_check posts a Cron (schedule+tz) check', async () => {
  const bodies: unknown[] = [];
  const client = await connectedClient('read-write', (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse((init?.body as string) ?? '{}'));
    return jsonResponse({ name: 'cron', uuid: 'x' }, 201);
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'create_check',
      arguments: { name: 'cron', schedule: '0 9 * * *', tz: 'Europe/Riga' }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(bodies[0], { name: 'cron', schedule: '0 9 * * *', tz: 'Europe/Riga' });
  } finally {
    mock.reset();
    await client.close();
  }
});

test('create_check with unique upserts instead of duplicating', async () => {
  const bodies: unknown[] = [];
  const client = await connectedClient('read-write', (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse((init?.body as string) ?? '{}'));
    return jsonResponse({ name: 'x', uuid: 'existing' }, 200);
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'create_check',
      arguments: { name: 'x', unique: ['name'] }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(bodies[0], { name: 'x', unique: ['name'] });
  } finally {
    mock.reset();
    await client.close();
  }
});

test('create_check surfaces a 403 (account limit) as a clean, distinct error', async () => {
  const client = await connectedClient('read-write', (async () =>
    jsonResponse({ error: 'limit reached' }, 403)) as typeof fetch);
  try {
    const result = await client.callTool({ name: 'create_check', arguments: { name: 'x' } });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /account limit/i);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('update_check only sends the fields given, omitted fields are not in the request body', async () => {
  const bodies: unknown[] = [];
  const client = await connectedClient('read-write', (async (url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(JSON.parse(init.body as string));
    return jsonResponse({ name: 'x', uuid: 'real-uuid-1234' });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'update_check',
      arguments: { check_id: 'real-uuid-1234', desc: 'new description' }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(bodies[0], { desc: 'new description' });
  } finally {
    mock.reset();
    await client.close();
  }
});

test('update_check on an invalid id returns a clean tool error, not a crash', async () => {
  const client = await connectedClient(
    'read-write',
    (async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
      })) as typeof fetch
  );
  try {
    const result = await client.callTool({
      name: 'update_check',
      arguments: { check_id: 'nope', desc: 'x' }
    });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /not found/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('pause_check without confirm:true returns an error and never calls the API', async () => {
  let called = false;
  const client = await connectedClient('read-write', (async () => {
    called = true;
    return jsonResponse({});
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'pause_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' }
    });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /confirm: true/);
    assert.equal(called, false);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('pause_check with confirm:true calls the pause endpoint', async () => {
  const calledUrls: string[] = [];
  const client = await connectedClient('read-write', (async (url: string) => {
    calledUrls.push(String(url));
    return jsonResponse({ status: 'paused' });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'pause_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7', confirm: true }
    });
    assert.equal(result.isError, undefined);
    assert.match(calledUrls[0], /\/pause$/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('resume_check on an already-active check surfaces the 409 cleanly', async () => {
  const client = await connectedClient('read-write', (async () =>
    jsonResponse({ error: 'not paused' }, 409)) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'resume_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' }
    });
    assert.equal(result.isError, true);
    assert.match(
      (result.content as Array<{ text: string }>)[0].text,
      /conflict|not currently be paused/i
    );
  } finally {
    mock.reset();
    await client.close();
  }
});

test('resume_check on an invalid id returns a clean tool error, not a crash', async () => {
  const client = await connectedClient(
    'read-write',
    (async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
      })) as typeof fetch
  );
  try {
    const result = await client.callTool({
      name: 'resume_check',
      arguments: { check_id: 'nope' }
    });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /not found/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('delete_check without confirm:true returns an error and never calls the API', async () => {
  let called = false;
  const client = await connectedClient('read-write', (async () => {
    called = true;
    return jsonResponse({});
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'delete_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' }
    });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /confirm: true/);
    assert.equal(called, false);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('delete_check with confirm:true issues a DELETE call', async () => {
  const seenMethods: Array<string | undefined> = [];
  const client = await connectedClient('read-write', (async (_url: string, init?: RequestInit) => {
    seenMethods.push(init?.method);
    return jsonResponse({ name: 'deleted' });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'delete_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7', confirm: true }
    });
    assert.equal(result.isError, undefined);
    assert.equal(seenMethods[0], 'DELETE');
  } finally {
    mock.reset();
    await client.close();
  }
});

test('delete_check is blocked on a read-only key, before the confirm check', async () => {
  const client = await connectedClient('read-only', (async () => jsonResponse({})) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'delete_check',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7', confirm: true }
    });
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

test('cross-tool sequencing: create -> pause -> resume -> delete against the same check', async () => {
  const uuid = 'ca3143a2-e1d4-4be1-a170-5a172aa04df7';
  const calledUrls: string[] = [];
  const client = await connectedClient('read-write', (async (url: string, init?: RequestInit) => {
    calledUrls.push(`${init?.method ?? 'GET'} ${url}`);
    return jsonResponse({ name: 'x', uuid });
  }) as typeof fetch);
  try {
    const create = await client.callTool({ name: 'create_check', arguments: { name: 'x' } });
    assert.equal(create.isError, undefined);

    const pause = await client.callTool({
      name: 'pause_check',
      arguments: { check_id: uuid, confirm: true }
    });
    assert.equal(pause.isError, undefined);

    const resume = await client.callTool({ name: 'resume_check', arguments: { check_id: uuid } });
    assert.equal(resume.isError, undefined);

    const del = await client.callTool({
      name: 'delete_check',
      arguments: { check_id: uuid, confirm: true }
    });
    assert.equal(del.isError, undefined);

    assert.match(calledUrls[0], /^POST .*\/checks\/$/);
    assert.match(calledUrls[1], /^POST .*\/pause$/);
    assert.match(calledUrls[2], /^POST .*\/resume$/);
    assert.match(calledUrls[3], /^DELETE /);
  } finally {
    mock.reset();
    await client.close();
  }
});

// --- v3 tools: flips, badges ---

test('list_check_flips returns the flips array', async () => {
  const client = await connectedClient('read-only', (async () =>
    jsonResponse({ flips: [{ timestamp: '2026-08-06T00:00:00Z', up: 1 }] })) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'list_check_flips',
      arguments: { check_id: 'ca3143a2-e1d4-4be1-a170-5a172aa04df7' }
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), [
      { timestamp: '2026-08-06T00:00:00Z', up: 1 }
    ]);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_flips passes check_id through directly (no resolveUuid), works on read-only key', async () => {
  const calledUrls: string[] = [];
  const client = await connectedClient('read-only', (async (url: string) => {
    calledUrls.push(String(url));
    return jsonResponse({ flips: [] });
  }) as typeof fetch);
  try {
    const result = await client.callTool({
      name: 'list_check_flips',
      arguments: { check_id: 'some-unique-key-value' }
    });
    assert.equal(result.isError, undefined);
    assert.equal(calledUrls.length, 1);
    assert.match(calledUrls[0], /\/checks\/some-unique-key-value\/flips\/$/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_flips passes seconds/start/end filters as query params', async () => {
  const calledUrls: string[] = [];
  const client = await connectedClient('read-only', (async (url: string) => {
    calledUrls.push(String(url));
    return jsonResponse({ flips: [] });
  }) as typeof fetch);
  try {
    await client.callTool({
      name: 'list_check_flips',
      arguments: { check_id: 'abc', seconds: 3600 }
    });
    assert.match(calledUrls[0], /\?seconds=3600$/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_check_flips on an invalid id returns a clean tool error, not a crash', async () => {
  const client = await connectedClient(
    'read-only',
    (async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
      })) as typeof fetch
  );
  try {
    const result = await client.callTool({
      name: 'list_check_flips',
      arguments: { check_id: 'nope' }
    });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0].text, /not found/);
  } finally {
    mock.reset();
    await client.close();
  }
});

test('list_badges returns the badges map', async () => {
  const badges = { 'my-tag': { svg: 'https://healthchecks.io/badge/x/y/my-tag.svg' } };
  const client = await connectedClient('read-only', (async () =>
    jsonResponse({ badges })) as typeof fetch);
  try {
    const result = await client.callTool({ name: 'list_badges', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), badges);
  } finally {
    mock.reset();
    await client.close();
  }
});
