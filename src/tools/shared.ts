import * as z from 'zod/v4';
import type { CallToolResult } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { CheckSummary } from '../lib/types.js';
import { toToolError } from '../lib/tool-errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The /pings/ endpoint only accepts a check's uuid, not its unique_key —
 * confirmed live in M03 (contrary to M01's assumption, which only tested
 * unique_key against the blocked read-only-key case, where either
 * identifier 401s identically). Resolve unique_key -> uuid via get_check
 * first so callers can pass either identifier, matching every other tool.
 */
export async function resolveUuid(
  client: HealthchecksClient,
  checkId: string,
  toolName = 'resolveUuid'
): Promise<{ ok: true; uuid: string } | { ok: false; result: CallToolResult }> {
  if (UUID_PATTERN.test(checkId)) return { ok: true, uuid: checkId };

  const lookup = await client.get<CheckSummary>(`/checks/${encodeURIComponent(checkId)}`);
  if (!lookup.ok) {
    return {
      ok: false,
      result: toToolError(lookup, `${toolName}(${checkId}) failed to resolve check`)
    };
  }
  if (!lookup.data.uuid) {
    return {
      ok: false,
      result: {
        content: [
          {
            type: 'text',
            text: `${toolName}(${checkId}): could not resolve a uuid for this check from the current API key's response.`
          }
        ],
        isError: true
      }
    };
  }
  return { ok: true, uuid: lookup.data.uuid };
}

export function readOnlyBlockedResult(toolName: string): CallToolResult {
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

/**
 * Server-enforced confirmation gate (decision #25, expanded at M05
 * spec-review to cover both delete_check and pause_check). Echoes the
 * caller-supplied check_id as given — does not issue an extra get_check
 * lookup first, matching decision #7's thin-wrapper posture.
 */
export function confirmRequiredResult(
  toolName: string,
  checkId: string,
  action: string
): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${toolName}(${checkId}): this would ${action}. Call again with confirm: true to proceed.`
      }
    ],
    isError: true as const
  };
}

/**
 * Shared field set for create_check/update_check — passed through to the
 * API as-is, no local validation duplicating HC.io's own (decision #7's
 * thin-wrapper posture). `timeout` and `schedule`+`tz` are mutually
 * exclusive at the API level (Simple vs Cron checks); this schema doesn't
 * enforce that locally, HC.io's 400 response does.
 */
export function checkInputFields() {
  return {
    name: z.string().optional().describe('Display name for the check.'),
    slug: z
      .string()
      .optional()
      .describe('URL-friendly identifier, auto-generated from name if omitted.'),
    tags: z.string().optional().describe('Space-separated tags.'),
    desc: z.string().optional().describe('Description.'),
    timeout: z
      .number()
      .optional()
      .describe(
        'Expected period in seconds (60-31536000). Mutually exclusive with schedule/tz — Simple check mode.'
      ),
    schedule: z
      .string()
      .optional()
      .describe(
        'Cron or OnCalendar expression. Mutually exclusive with timeout — Cron check mode.'
      ),
    tz: z
      .string()
      .optional()
      .describe('IANA timezone for schedule, e.g. "Europe/Riga". Only used with schedule.'),
    grace: z.number().optional().describe('Grace period in seconds.'),
    manual_resume: z
      .boolean()
      .optional()
      .describe('If true, a paused check only resumes via resume_check, not on the next ping.'),
    channels: z
      .string()
      .optional()
      .describe('Comma-separated integration UUIDs/names to notify, or "*" for all.'),
    unique: z
      .array(z.string())
      .optional()
      .describe(
        'create_check only: fields to match on for idempotent upsert (e.g. ["name"]) — a repeated call with matching values updates the existing check instead of creating a duplicate.'
      ),
    start_kw: z.string().optional().describe('Keyword marking a ping as "start".'),
    success_kw: z.string().optional().describe('Keyword marking a ping as success.'),
    failure_kw: z.string().optional().describe('Keyword marking a ping as failure.'),
    filter_subject: z.boolean().optional(),
    filter_body: z.boolean().optional(),
    filter_http_body: z.boolean().optional(),
    filter_default_fail: z.boolean().optional()
  };
}
