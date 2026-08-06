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

`npm test`'s `node --test` target lists each compiled test file
explicitly (`dist/smoke.test.js`) rather than pointing at the `dist`
directory or a glob — passing `dist` directly makes Node's test runner
also try to execute `dist/index.js`, which never exits (it's the stdio
server), hanging the run forever. Add new test files to the `test` script
by name as they're created.

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
