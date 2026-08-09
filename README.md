# @digitalronin/healthchecks-io-mcp

> **Unofficial, unaffiliated with Healthchecks.io.** This is a third-party
> MCP server, not an official Healthchecks.io product.

## What this is

[Healthchecks.io](https://healthchecks.io) is a "dead man's switch" style
monitoring service: your scheduled jobs (cron jobs, backups, batch scripts,
anything that's supposed to run on a schedule) ping it when they run, and
Healthchecks.io alerts you if a ping doesn't show up on time — meaning the
job silently failed or never ran.

This package is an **MCP server** — a small local program that lets an AI
assistant like Claude talk to Healthchecks.io's
[Management API](https://healthchecks.io/docs/api/) on your behalf. Once
it's set up, you can ask your AI assistant things like "list my
Healthchecks.io checks," "show me the ping history for my backup job," or
"pause monitoring for my staging environment" in plain English, and it
will call the right Healthchecks.io API endpoint for you.

## Setup

### 1. Get a Healthchecks.io API key

1. Log in to [healthchecks.io](https://healthchecks.io) (or your
   self-hosted instance, see below).
2. Go to your project's **Settings** page, then the **API Access** tab.
3. You'll see two keys: a **read-only** key and a **read-write** key.
   - The **read-only** key can look up your checks, but can't create,
     change, pause, or delete anything.
   - The **read-write** key can do everything the read-only key can, plus
     create, update, pause, resume, and **permanently delete** checks.

### 2. Add this server to your MCP client's config

You don't need to install anything manually — `npx` will download and run
it automatically the first time it's used. Add this block to your MCP
client's configuration (for Claude Code, this is a `.mcp.json` file; other
clients have their own config file or UI for this):

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

Replace `"your-key-here"` with the API key from step 1. Restart your MCP
client (or reload its MCP connections) after saving this — most clients
only pick up new/changed servers on restart.

### 3. Try it out

Once connected, just ask your AI assistant something like:

- "List all my Healthchecks.io checks"
- "Show me the ping history for my nightly-backup check"
- "Is my staging-cron check currently failing?"

If it responds with real data from your account, you're set up correctly.

### Optional: self-hosted Healthchecks.io

Healthchecks.io is open source, and some people run their own instance
instead of using the hosted SaaS service at healthchecks.io. If that's
you, add a second environment variable pointing at your instance's API
root:

```json
"env": {
  "HEALTHCHECKS_API_KEY": "your-key-here",
  "HEALTHCHECKS_BASE_URL": "https://monitoring.example.com/api/v3"
}
```

The URL must be the full API root, **including the `/api/v3` path
segment**, with **no trailing slash** — e.g.
`https://monitoring.example.com/api/v3`, not
`https://monitoring.example.com` or
`https://monitoring.example.com/api/v3/`. Getting this wrong will make
every tool call fail with a "not found" error, since the server appends
paths like `/checks/` directly onto whatever you set here. If you leave
`HEALTHCHECKS_BASE_URL` unset, it defaults to the real
`https://healthchecks.io/api/v3`.

If your self-hosted instance isn't behind HTTPS, the server will print a
warning (but still run) — your API key is sent as a request header on
every call, so an `http://` URL means that key travels in plaintext over
the network to your instance.

## What it can do

This server exposes 11 "tools" that your AI assistant can call. They fall
into two groups:

**Read tools** — safe, look-up-only, never change anything:

| Tool                | What it does                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `list_checks`       | List every check in your account.                                                                                             |
| `get_check`         | Get full details for one specific check.                                                                                      |
| `list_check_pings`  | Show the recent ping history for a check (when it pinged in, success/fail/etc). _Requires a read-write key — see note below._ |
| `list_check_flips`  | Show when a check's status changed (e.g. went from healthy to failing, or back).                                              |
| `list_integrations` | List your configured notification integrations (Slack, email, etc). _Requires a read-write key — see note below._             |
| `list_badges`       | Get the badge image URLs Healthchecks.io generates for each of your tags (useful for status pages/dashboards).                |

**Mutating tools** — these change things in your account, and all of them
require a **read-write** API key:

| Tool           | What it does                                                                                                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_check` | Create a new check (e.g. "create a check called nightly-backup that expects a ping every 24 hours"). Can optionally be told to match on existing fields (like the check's name) and update that check instead of creating a duplicate — useful if a job might register itself more than once. |
| `update_check` | Change an existing check's settings. Only the fields you specify are changed — anything you don't mention stays as it was.                                                                                                                                                                    |
| `pause_check`  | Temporarily stop monitoring a check, without deleting it. **Requires explicit confirmation** — see below.                                                                                                                                                                                     |
| `resume_check` | Resume monitoring on a paused check.                                                                                                                                                                                                                                                          |
| `delete_check` | **Permanently delete** a check — this cannot be undone. **Requires explicit confirmation** — see below.                                                                                                                                                                                       |

## Technical reference

For each tool, this table gives its underlying Healthchecks.io API
endpoint:

| Tool                | Requires read-write key? | Healthchecks.io API endpoint                                                               |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `list_checks`       | No                       | [`GET /api/v3/checks/`](https://healthchecks.io/docs/api/#list-checks)                     |
| `get_check`         | No                       | [`GET /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#get-check)                 |
| `list_check_pings`  | Yes                      | [`GET /api/v3/checks/{uuid}/pings/`](https://healthchecks.io/docs/api/#list-pings)         |
| `list_check_flips`  | No                       | [`GET /api/v3/checks/{uuid}/flips/`](https://healthchecks.io/docs/api/#list-flips)         |
| `list_integrations` | Yes                      | [`GET /api/v3/channels/`](https://healthchecks.io/docs/api/#list-channels)                 |
| `list_badges`       | No                       | [`GET /api/v3/badges/`](https://healthchecks.io/docs/api/#list-badges)                     |
| `create_check`      | Yes                      | [`POST /api/v3/checks/`](https://healthchecks.io/docs/api/#create-check)                   |
| `update_check`      | Yes                      | [`POST /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#update-check)             |
| `pause_check`       | Yes                      | [`POST /api/v3/checks/{uuid}/pause`](https://healthchecks.io/docs/api/#pause-monitoring)   |
| `resume_check`      | Yes                      | [`POST /api/v3/checks/{uuid}/resume`](https://healthchecks.io/docs/api/#resume-monitoring) |
| `delete_check`      | Yes                      | [`DELETE /api/v3/checks/{uuid}`](https://healthchecks.io/docs/api/#delete-check)           |
