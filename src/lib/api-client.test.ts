import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { HealthchecksClient } from './api-client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('get() returns ok:true on a 200 JSON response', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ hello: 'world' }));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/checks/');
    assert.deepEqual(result, { ok: true, data: { hello: 'world' } });
  } finally {
    mock.reset();
  }
});

test('get() returns kind:unauthorized on a 401', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'wrong api key' }, 401));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/channels/');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'unauthorized');
  } finally {
    mock.reset();
  }
});

test('get() returns kind:not_found on a 404 with an HTML body (Django default page)', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
      })
  );
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/checks/does-not-exist');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'not_found');
  } finally {
    mock.reset();
  }
});

test('get() returns kind:unexpected with the real status on a non-401/404 error (e.g. 429/500)', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'rate limited' }, 429));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/checks/');
    assert.equal(result.ok, false);
    if (!result.ok && result.kind === 'unexpected') {
      assert.equal(result.status, 429);
    } else {
      assert.fail('expected kind:unexpected with status 429');
    }
  } finally {
    mock.reset();
  }
});

test('get() returns kind:unexpected on a 200 with a non-JSON body', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } })
  );
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/checks/');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'unexpected');
  } finally {
    mock.reset();
  }
});

test('get() returns kind:network on a fetch rejection', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.get('/checks/');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'network');
  } finally {
    mock.reset();
  }
});

test('get() times out cleanly rather than hanging', async () => {
  mock.method(
    globalThis,
    'fetch',
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
  );
  try {
    const client = new HealthchecksClient({ apiKey: 'k', timeoutMs: 50 });
    const result = await client.get('/checks/');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, 'network');
      assert.match(result.message, /timed out/);
    }
  } finally {
    mock.reset();
  }
});

test('getAllPages() follows a next URL until it is absent', async () => {
  let call = 0;
  mock.method(globalThis, 'fetch', async () => {
    call += 1;
    if (call === 1)
      return jsonResponse({
        checks: [{ name: 'a' }],
        next: 'https://healthchecks.io/api/v3/checks/?page=2'
      });
    return jsonResponse({ checks: [{ name: 'b' }], next: null });
  });
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.getAllPages<
      { checks: Array<{ name: string }>; next: string | null },
      { name: string }
    >(
      '/checks/',
      (d) => d.checks,
      (d) => d.next
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data, [{ name: 'a' }, { name: 'b' }]);
    assert.equal(call, 2);
  } finally {
    mock.reset();
  }
});

test('getAllPages() treats a response with no next field as a flat single-page list', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ checks: [{ name: 'only' }] }));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.getAllPages<{ checks: Array<{ name: string }> }, { name: string }>(
      '/checks/',
      (d) => d.checks,
      () => undefined
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data, [{ name: 'only' }]);
  } finally {
    mock.reset();
  }
});

test('post() sends the body as JSON and returns ok:true on success', async () => {
  let seenBody: string | undefined;
  let seenMethod: string | undefined;
  mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    seenBody = init?.body as string | undefined;
    seenMethod = init?.method;
    return jsonResponse({ name: 'created' }, 201);
  });
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.post('/checks/', { name: 'my check' });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data, { name: 'created' });
    assert.equal(seenMethod, 'POST');
    assert.deepEqual(JSON.parse(seenBody ?? '{}'), { name: 'my check' });
  } finally {
    mock.reset();
  }
});

test('del() issues a DELETE request', async () => {
  let seenMethod: string | undefined;
  mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    seenMethod = init?.method;
    return jsonResponse({ name: 'deleted' });
  });
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.del('/checks/some-uuid');
    assert.equal(result.ok, true);
    assert.equal(seenMethod, 'DELETE');
  } finally {
    mock.reset();
  }
});

test('post() returns kind:forbidden on a 403', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'account limit' }, 403));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.post('/checks/', { name: 'x' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'forbidden');
  } finally {
    mock.reset();
  }
});

test('post() returns kind:conflict on a 409', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'not paused' }, 409));
  try {
    const client = new HealthchecksClient({ apiKey: 'k' });
    const result = await client.post('/checks/some-uuid/resume');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, 'conflict');
  } finally {
    mock.reset();
  }
});

test('post() times out cleanly rather than hanging, same as get()', async () => {
  mock.method(
    globalThis,
    'fetch',
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
  );
  try {
    const client = new HealthchecksClient({ apiKey: 'k', timeoutMs: 50 });
    const result = await client.post('/checks/', { name: 'x' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.kind, 'network');
      assert.match(result.message, /timed out/);
    }
  } finally {
    mock.reset();
  }
});

test('get() never includes the API key in any returned error message', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'wrong api key' }, 401));
  try {
    const client = new HealthchecksClient({ apiKey: 'super-secret-key-value' });
    const result = await client.get('/channels/');
    assert.equal(result.ok, false);
    if (!result.ok) assert.doesNotMatch(result.message, /super-secret-key-value/);
  } finally {
    mock.reset();
  }
});
