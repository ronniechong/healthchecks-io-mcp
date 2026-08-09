# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
this project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-08-09

### Added

- v2 mutating tools: `create_check` (with `unique`-param upsert),
  `update_check` (partial update), `pause_check`, `resume_check`,
  `delete_check`. All require a read-write API key.
- Server-enforced `confirm: true` safeguard on `pause_check` and
  `delete_check` — omitting it returns a clear error without calling the
  API.
- Clean, distinct error handling for HTTP 403 (e.g. free-tier check-count
  cap) and 409 (e.g. resuming a check that isn't paused) responses.

### Changed

- **Breaking (semver-major):** a read-write API key now unlocks
  destructive capability (`delete_check`) that v1 never exposed. No
  existing v1 tool's behavior changed, but this is a significant enough
  capability shift to call out with a major version bump rather than a
  minor one.
- README: added a stronger key-handling warning reflecting this — a
  leaked read-write key can now silently delete monitoring, not just
  expose data. Recommend a dedicated, rotatable key.

## [1.0.1] - 2026-08-09

### Changed

- README: refresh status line to reflect the npm publish (previously said
  "currently private, not yet published").

## [1.0.0] - 2026-08-09

### Added

- v1 read-only tools: `list_checks`, `get_check`, `list_check_pings`,
  `list_integrations`.
- API key tier detection (read-only vs read-write), with clean errors on
  tier-restricted tools instead of raw API errors.
