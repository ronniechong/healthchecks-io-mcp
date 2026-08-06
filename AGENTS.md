# AGENTS.md

## What this is

An MCP server exposing [Healthchecks.io](https://healthchecks.io)'s
Management API as MCP tools, distributed as an installable local package
(`npx healthchecks-io-mcp`) — a stdio-transport MCP server, not a hosted
service. Unofficial, unaffiliated with Healthchecks.io.

## Stack

- TypeScript, strict mode, ESM (`NodeNext` module resolution)
- `@modelcontextprotocol/server` / `@modelcontextprotocol/client` (official
  MCP SDK) — the only runtime dependency
- Native `fetch` (Node 18+) for HTTP — no HTTP client library
- `node:test` for unit/integration tests — no external test framework
- npm as the package manager

## Commands

```
npm install       # install dependencies
npm run build      # compile TypeScript to dist/
npm run typecheck  # type-check without emitting
npm test           # build, then run tests (node:test)
npm audit           # dependency vulnerability check
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
  construction lives in `src/server-factory.ts` instead, which is safe to
  import.
- The Healthchecks.io `/checks/{id}/pings/` endpoint only accepts a
  check's `uuid`, not its `unique_key` — confirmed live in M03, and
  different from `/checks/{id}` (`get_check`), which accepts either. The
  `list_check_pings` tool resolves a non-uuid-shaped `check_id` via
  `get_check` first (see `resolveUuid` in `src/tools.ts`) so callers can
  pass either identifier consistently across tools.
- `HEALTHCHECKS_BASE_URL` is an internal, undocumented env var used only
  by the subprocess-spawning tests (`smoke.test.ts`, `key-redaction.test.ts`)
  to point the server at a local mock instead of the real API. It is not a
  supported user-facing config option — self-hosted base-URL support is
  deferred to v1.1 (decision #3 in the private working docs).

## Feature philosophy

v1 ships read-only tools only. Mutating tools (v2) come later, once v1 is
proven. Keep the dependency tree minimal — every dependency sits in the
attack surface for a user's Healthchecks.io API key.

## Security

This server handles a live third-party API key. Never log the key or let
it appear in error messages, stack traces, or crash output. Redact it in
any diagnostic output.

## Contributing

Issues and PRs welcome. Run `npm test` and `npm run typecheck` before
submitting.
