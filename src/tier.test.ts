import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectKeyTier, prefixHint } from './tier.js';
import type { HealthchecksClient, ApiResult } from './api-client.js';

function fakeClient(result: ApiResult<unknown>): Pick<HealthchecksClient, 'get'> {
    return { get: async () => result as never };
}

test('detectKeyTier() returns read-write on a successful /channels/ probe', async () => {
    const tier = await detectKeyTier(fakeClient({ ok: true, data: [] }) as HealthchecksClient);
    assert.equal(tier, 'read-write');
});

test('detectKeyTier() returns read-only on an unauthorized /channels/ probe', async () => {
    const tier = await detectKeyTier(
        fakeClient({ ok: false, kind: 'unauthorized', message: 'nope' }) as HealthchecksClient
    );
    assert.equal(tier, 'read-only');
});

test('detectKeyTier() throws on an ambiguous (network) probe failure rather than guessing', async () => {
    await assert.rejects(
        () => detectKeyTier(fakeClient({ ok: false, kind: 'network', message: 'down' }) as HealthchecksClient)
    );
});

test('prefixHint() reads the undocumented hcr_/hcw_ prefix as a fast, non-authoritative hint only', () => {
    assert.equal(prefixHint('hcw_abc'), 'read-write');
    assert.equal(prefixHint('hcr_abc'), 'read-only');
    assert.equal(prefixHint('something-else'), 'unknown');
});
