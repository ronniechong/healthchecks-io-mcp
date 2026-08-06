# healthchecks-io-mcp

> **Unofficial, unaffiliated with Healthchecks.io.** This is a third-party
> MCP server, not an official Healthchecks.io product.

An MCP (Model Context Protocol) server that lets an MCP client (e.g. Claude)
manage [Healthchecks.io](https://healthchecks.io) checks via its Management
API.

## Status

v1 (read-only tools) implemented. This repo is currently private while it's
being verified and tested — not yet published to npm.

## Setup

1. Get a Healthchecks.io API key from your account's **Settings → API
   Access** page. Either key tier works; a read-only key can't use
   `list_check_pings` or `list_integrations` (see below).
2. Set it as an environment variable: `HEALTHCHECKS_API_KEY`.

Example MCP client config (stdio):

```json
{
  "mcpServers": {
    "healthchecks-io": {
      "command": "npx",
      "args": ["healthchecks-io-mcp"],
      "env": {
        "HEALTHCHECKS_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Tools

| Tool | Description | Requires read-write key? |
|---|---|---|
| `list_checks` | List all checks on the account. | No |
| `get_check` | Get a single check's details, by UUID or unique key. | No |
| `list_check_pings` | List recent ping history for a check. | Yes |
| `list_integrations` | List configured notification integrations. | Yes |

The server detects your API key's tier once when it connects. If it's a
read-only key, `list_check_pings` and `list_integrations` return a clear
error explaining the restriction instead of a raw API error.
