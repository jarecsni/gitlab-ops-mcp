# Changelog
## [1.1.0] - 2026-03-05

### Added
- `create_project` tool with `namespace_id` support for creating projects inside groups
- Server metadata endpoint, enriched tool descriptions, storefront discoverability
- `.well-known/mcp/server-card.json` endpoint for registry discovery
- `X-GitLab-Api-Url` header support for per-session API URL override

### Fixed
- OAuth discovery and `/register` endpoints for Smithery scanner compatibility
- Bearer token fallback for Smithery scanner
- GET handler on `/register` and `/token` routes

### Removed
- Smithery-specific exports and `smithery.yaml`

## [1.0.2] - 2026-02-21

### Fixed
- Guard `main()` with token check so Smithery scanner can import `configSchema` without crashing

## [1.0.1] - 2026-02-21

### Fixed
- Wrapped top-level `await` in `async main()` for Smithery esbuild CJS bundler compatibility
- Added `.smithery/` to `.gitignore`

## [1.0.0] - 2026-02-21

### Added
- 21 MCP tools across 7 GitLab operational domains: webhooks, CI/CD variables, protected branches, project settings, groups, access tokens, and pipeline triggers
- Stdio transport for local use (`npx gitlab-ops-mcp`)
- Streamable HTTP transport for remote deployment (`src/server.ts`)
- Per-session GitLab token via `X-GitLab-Token` header (HTTP) or `GITLAB_PERSONAL_ACCESS_TOKEN` env var (stdio)
- Smithery integration with `configSchema` export and `smithery.yaml`
- Dockerfile for containerised deployment
- Fly.io configuration (`fly.toml`)
- Comprehensive test suite: 285 tests across 15 files (unit + property-based with fast-check)
- Release infrastructure with automated versioning, build-info generation, and changelog management
