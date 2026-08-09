# @digitalronin/healthchecks-io-mcp

> **Unofficial, unaffiliated with Healthchecks.io.** This is a third-party
> MCP server, not an official Healthchecks.io product.

An MCP (Model Context Protocol) server that lets an MCP client (e.g. Claude)
manage [Healthchecks.io](https://healthchecks.io) checks via its
[Management API](https://healthchecks.io/docs/api/).

## Status

v2 (read-only + mutating tools) published to npm as `2.0.0`.

## Setup

1. Get a Healthchecks.io API key from your account's **Settings → API
   Access** page. A read-only key only unlocks the read tools (see below).
   A read-write key unlocks everything, **including deleting checks** —
   as of v2, a leaked read-write key can silently disable or delete your
   monitoring, not just expose data. Use a dedicated key for this server
   and rotate it if you suspect it's been exposed.
2. Set it as an environment variable: `HEALTHCHECKS_API_KEY`.

Example MCP client config (stdio):

```json
{
  "mcpServers": {
    "healthchecks-io": {
      "command": "npx",
      "args": ["@digitalronin/healthchecks-io-mcp"],
      "env": {
        "HEALTHCHECKS_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Scope

Read tools work with either key tier (except `list_check_pings` and
`list_integrations`, which need a read-write key). Mutating tools always
need a read-write key. `delete_check` and `pause_check` also require an
explicit `confirm: true` argument — calling either without it returns an
error describing what would happen, without making any API call. This is a
safeguard against accidental single-call misuse; it does not (and cannot,
over MCP's protocol) verify that a human — rather than the calling agent
itself — actually approved the action.

| Tool                | Description                                               | Requires read-write key? | Healthchecks.io API endpoint                                                               |
| ------------------- | --------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `list_checks`       | List all checks on the account.                           | No                       | [`GET /api/v3/checks/`](https://healthchecks.io/docs/api/#list-checks)                     |
| `get_check`         | Get a single check's details, by UUID or unique key.      | No                       | [`GET /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#get-check)                 |
| `list_check_pings`  | List recent ping history for a check.                     | Yes                      | [`GET /api/v3/checks/{uuid}/pings/`](https://healthchecks.io/docs/api/#list-pings)         |
| `list_integrations` | List configured notification integrations.                | Yes                      | [`GET /api/v3/channels/`](https://healthchecks.io/docs/api/#list-channels)                 |
| `create_check`      | Create a check, or upsert one via the `unique` param.     | Yes                      | [`POST /api/v3/checks/`](https://healthchecks.io/docs/api/#create-check)                   |
| `update_check`      | Partially update a check — omitted fields stay unchanged. | Yes                      | [`POST /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#update-check)             |
| `pause_check`       | Pause monitoring. Requires `confirm: true`.               | Yes                      | [`POST /api/v3/checks/{uuid}/pause`](https://healthchecks.io/docs/api/#pause-monitoring)   |
| `resume_check`      | Resume monitoring for a paused check.                     | Yes                      | [`POST /api/v3/checks/{uuid}/resume`](https://healthchecks.io/docs/api/#resume-monitoring) |
| `delete_check`      | Permanently delete a check. Requires `confirm: true`.     | Yes                      | [`DELETE /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#delete-check)           |

Integrations (notification channels) have no create/update/delete API —
Healthchecks.io only supports managing those through its web dashboard, so
this server can't either.

The server detects your API key's tier once when it connects. On a
read-only key, every write-tool call (and `list_check_pings`/
`list_integrations`) returns a clear error explaining the restriction
instead of a raw API error or a missing tool.
