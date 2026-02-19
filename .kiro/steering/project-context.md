---
inclusion: auto
---

# Project Context: gitlab-ops-mcp

## What This Is

A supplementary MCP server for GitLab providing the operational/orchestration layer missing from `@zereight/mcp-gitlab`. Covers webhooks, CI/CD variables, branch protection, project settings, groups, project access tokens, and pipeline trigger tokens.

## Tech Stack

- Node.js / TypeScript
- `@modelcontextprotocol/sdk` for MCP server implementation
- Thin REST wrappers around GitLab API v4
- Published to npm as `gitlab-ops-mcp`

## Auth Pattern

Same as existing GitLab MCP: `GITLAB_PERSONAL_ACCESS_TOKEN` and `GITLAB_API_URL` via environment variables.

## Key Design Principles

- No duplication of what `@zereight/mcp-gitlab` already provides
- Thin REST wrappers — no business logic, no state
- Read-only tools safe to auto-approve; mutating tools require confirmation
- 21 tools across 7 domains

## Scope Document

Full scope details in #[[file:gitlab-ops-mcp-scope.md]]
