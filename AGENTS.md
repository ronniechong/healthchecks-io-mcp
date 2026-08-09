# AGENTS.md

## What this is

An MCP server exposing [Healthchecks.io](https://healthchecks.io)'s
Management API as MCP tools, distributed as an installable local package
(`npx @digitalronin/healthchecks-io-mcp`) — a stdio-transport MCP server, not a hosted
service. Unofficial, unaffiliated with Healthchecks.io.

## Stack

- TypeScript, strict mode, ESM (`NodeNext` module resolution)
- `@modelcontextprotocol/server` / `@modelcontextprotocol/client` (official
  MCP SDK) — the only runtime dependency
- Native `fetch` (Node 18+) for HTTP — no HTTP client library
- `node:test` for unit/integration tests — no external test framework
- npm as the package manager
- Prettier (2-space indent, single quotes, no trailing commas) +
  EditorConfig for consistent formatting across editors

## Structure

```
src/
  index.ts              entrypoint — reads env, wires everything, runs main()
  smoke.test.ts          subprocess-level test (spawns dist/index.js)
  key-redaction.test.ts  subprocess-level test (spawns dist/index.js)
  config/                constants (base URL, timeouts)
  lib/                   API client, key-tier detection, error translation,
                          response types — shared, no MCP-specific code
  server/                McpServer/client construction (server-factory.ts)
  tools/                 one file per MCP tool (5 v1 read tools, 5 v2
                          mutating tools), plus shared.ts for helpers used
                          by more than one tool (resolveUuid,
                          readOnlyBlockedResult, confirmRequiredResult,
                          checkInputFields), index.ts aggregates
                          registration
```

## Commands

```
npm install         # install dependencies
npm run build        # compile TypeScript to dist/
npm run typecheck    # type-check without emitting
npm test             # build, then run tests (node:test)
npm run format        # apply Prettier formatting
npm run format:check  # check formatting without writing (CI uses this)
npm audit             # dependency vulnerability check
```

## Gotchas

- `npm test`'s `node --test` target lists each compiled test file
  explicitly rather than pointing at the `dist` directory or a glob —
  passing `dist` directly makes Node's test runner also try to execute
  `dist/index.js`, which never exits (it's the stdio server), hanging the
  run forever. Add new test files to the `test` script by name as they're
  created.
- `src/index.ts` has a top-level `main()` call as a side effect of import
  — never import from `index.ts` in tests (it will try to read
  `HEALTHCHECKS_API_KEY` and call `process.exit`). Server/client
  construction lives in `src/server/server-factory.ts` instead, which is
  safe to import.
- The Healthchecks.io `/checks/{id}/pings/` endpoint only accepts a
  check's `uuid`, not its `unique_key` — confirmed live in M03, and
  different from `/checks/{id}` (`get_check`), which accepts either. The
  `list_check_pings` tool resolves a non-uuid-shaped `check_id` via
  `get_check` first (see `resolveUuid` in `src/tools/shared.ts`) so
  callers can pass either identifier consistently across tools.
- `HEALTHCHECKS_BASE_URL` is an internal, undocumented env var used only
  by the subprocess-spawning tests (`smoke.test.ts`, `key-redaction.test.ts`)
  to point the server at a local mock instead of the real API. It is not a
  supported user-facing config option — self-hosted base-URL support is
  deferred to v1.1 (decision #3 in the private working docs).
- The entire test suite runs against mocked `fetch` or a local mock HTTP
  server — no test calls the real Healthchecks.io API. This keeps CI fast
  and credential-free, but means a real API change (renamed field,
  different error shape) would only be caught by manual testing, not by
  `npm test`.
- `pause_check` and `delete_check` require an explicit `confirm: true`
  argument (`confirmRequiredResult` in `shared.ts`) — this is a
  server-enforced safeguard against accidental single-call misuse, not a
  human-approval guarantee. MCP has no protocol-level way to distinguish a
  genuinely human-directed `confirm: true` from a calling LLM setting it
  on its own (e.g. under prompt injection). Documented as an accepted
  residual risk, not solved.
- Integrations (notification channels) have no write API at all on
  Healthchecks.io's side — not a scope choice this project made, a hard
  API limit. Don't add `create_integration`-style tools; there's no
  endpoint to call.
- Published to the official MCP Registry as
  `io.github.ronniechong/healthchecks-io-mcp`, via `server.json` at the
  repo root and the `mcp-publisher` CLI. On every version bump: update
  both `version` fields in `server.json` (top-level and inside
  `packages[0]`) to match `package.json`, publish to npm first (the
  registry only stores metadata, not artifacts, and validates against the
  already-published npm package's `mcpName` field), then run
  `mcp-publisher publish`. Forgetting this step doesn't break anything —
  the registry listing just goes stale, pointing at an older version.

## Feature philosophy

v1 (read-only tools) and v2 (mutating tools, gated to a read-write key)
have both shipped. Keep the dependency tree minimal — every dependency
sits in the attack surface for a user's Healthchecks.io API key.

## Security

This server handles a live third-party API key. Never log the key or let
it appear in error messages, stack traces, or crash output. Redact it in
any diagnostic output. As of v2, a leaked read-write key can silently
delete a user's monitoring, not just expose data — treat any new
write-path code with that in mind.

## Contributing

Issues and PRs welcome. Run `npm test` and `npm run typecheck` before
submitting.
