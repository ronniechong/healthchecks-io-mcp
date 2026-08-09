# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
this project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-09

### Added

- v1 read-only tools: `list_checks`, `get_check`, `list_check_pings`,
  `list_integrations`.
- API key tier detection (read-only vs read-write), with clean errors on
  tier-restricted tools instead of raw API errors.
