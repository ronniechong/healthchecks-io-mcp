import * as z from 'zod/v4';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from './api-client.js';
import type { KeyTier } from './tier.js';
import { toToolError } from './tool-errors.js';
import type { ListChecksResponse, ListPingsResponse, ListChannelsResponse, CheckSummary, Ping } from './types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The /pings/ endpoint only accepts a check's uuid, not its unique_key —
 * confirmed live in M03 (contrary to M01's assumption, which only tested
 * unique_key against the blocked read-only-key case, where either
 * identifier 401s identically). Resolve unique_key -> uuid via get_check
 * first so callers can pass either identifier, matching every other tool.
 */
async function resolveUuid(client: HealthchecksClient, checkId: string): Promise<{ ok: true; uuid: string } | { ok: false; result: CallToolResult }> {
    if (UUID_PATTERN.test(checkId)) return { ok: true, uuid: checkId };

    const lookup = await client.get<CheckSummary>(`/checks/${encodeURIComponent(checkId)}`);
    if (!lookup.ok) return { ok: false, result: toToolError(lookup, `list_check_pings(${checkId}) failed to resolve check`) };
    if (!lookup.data.uuid) {
        return {
            ok: false,
            result: {
                content: [
                    {
                        type: 'text',
                        text: `list_check_pings(${checkId}): could not resolve a uuid for this check from the current API key's response.`
                    }
                ],
                isError: true
            }
        };
    }
    return { ok: true, uuid: lookup.data.uuid };
}

function readOnlyBlockedResult(toolName: string): CallToolResult {
    return {
        content: [
            {
                type: 'text' as const,
                text: `${toolName} requires a read-write Healthchecks.io API key. This server detected a read-only key when it connected.`
            }
        ],
        isError: true as const
    };
}

export function registerTools(server: McpServer, client: HealthchecksClient, tier: KeyTier): void {
    server.registerTool(
        'list_checks',
        { description: 'List all Healthchecks.io checks on this account.' },
        async () => {
            const result = await client.getAllPages<ListChecksResponse, CheckSummary>(
                '/checks/',
                (data) => data.checks,
                (data) => data.next
            );
            if (!result.ok) return toToolError(result, 'list_checks failed');
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    server.registerTool(
        'get_check',
        {
            description: "Get details for a single Healthchecks.io check by its UUID or unique key.",
            inputSchema: {
                check_id: z.string().describe("The check's UUID or unique_key.")
            }
        },
        async ({ check_id }) => {
            const result = await client.get<CheckSummary>(`/checks/${encodeURIComponent(check_id)}`);
            if (!result.ok) return toToolError(result, `get_check(${check_id}) failed`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    server.registerTool(
        'list_check_pings',
        {
            description: 'List recent ping history for a check. Requires a read-write API key.',
            inputSchema: {
                check_id: z.string().describe("The check's UUID or unique_key.")
            }
        },
        async ({ check_id }) => {
            if (tier === 'read-only') return readOnlyBlockedResult('list_check_pings');

            const resolved = await resolveUuid(client, check_id);
            if (!resolved.ok) return resolved.result;

            const result = await client.getAllPages<ListPingsResponse, Ping>(
                `/checks/${encodeURIComponent(resolved.uuid)}/pings/`,
                (data) => data.pings,
                (data) => data.next
            );
            if (!result.ok) return toToolError(result, `list_check_pings(${check_id}) failed`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    server.registerTool(
        'list_integrations',
        { description: 'List configured notification integrations (channels). Requires a read-write API key.' },
        async () => {
            if (tier === 'read-only') return readOnlyBlockedResult('list_integrations');
            const result = await client.get<ListChannelsResponse>('/channels/');
            if (!result.ok) return toToolError(result, 'list_integrations failed');
            return { content: [{ type: 'text', text: JSON.stringify(result.data.channels, null, 2) }] };
        }
    );
}
