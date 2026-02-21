# gitlab-ops-mcp

[![npm version](https://img.shields.io/npm/v/gitlab-ops-mcp)](https://www.npmjs.com/package/gitlab-ops-mcp)
[![licence](https://img.shields.io/npm/l/gitlab-ops-mcp)](https://github.com/jarecsni/gitlab-ops-mcp/blob/main/LICENSE)

The operational layer for GitLab that the standard MCP doesn't cover. Webhooks, CI/CD variables, branch protection, project settings, groups, access tokens, and pipeline triggers — 21 tools across 7 domains, ready for automated project setup and delivery orchestration.

## Why?

The existing GitLab MCP ([`@zereight/mcp-gitlab`](https://www.npmjs.com/package/@anthropic-ai/mcp-gitlab)) covers the developer workspace: repos, branches, MRs, issues, pipelines. But when you need to *set up* and *govern* projects — configure webhooks, protect branches, manage CI variables across repos — you're back in the GitLab UI clicking buttons.

`gitlab-ops-mcp` fills that gap. Together with the standard MCP, you get complete GitLab API coverage for fully automated multi-repo project setup.

## Quick Start

### Local (stdio transport)

Run directly with npx — no install required:

```
npx gitlab-ops-mcp
```

Requires `GITLAB_PERSONAL_ACCESS_TOKEN` in your environment.

### Remote (HTTP transport)

A hosted instance is available at:

```
https://gitlab-ops-mcp.fly.dev/mcp
```

The remote server uses per-session authentication via the `X-GitLab-Token` header — no server-side credentials stored.

## MCP Client Configuration

### Stdio (local)

```
{
  "mcpServers": {
    "gitlab-ops": {
      "command": "npx",
      "args": ["-y", "gitlab-ops-mcp"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-...",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      }
    }
  }
}
```

### Streamable HTTP (remote)

```
{
  "mcpServers": {
    "gitlab-ops": {
      "type": "streamable-http",
      "url": "https://gitlab-ops-mcp.fly.dev/mcp",
      "headers": {
        "X-GitLab-Token": "glpat-..."
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITLAB_PERSONAL_ACCESS_TOKEN` | Yes (stdio) | — | GitLab personal access token with appropriate scopes |
| `GITLAB_API_URL` | No | `https://gitlab.com/api/v4` | GitLab API v4 base URL |

For the HTTP transport, the GitLab token is passed per-request via the `X-GitLab-Token` header instead.

## Tool Catalogue

21 tools across 7 domains. Each tool is a thin REST wrapper around the GitLab API v4.

### Webhooks

Manage project-level webhooks for event-driven automation.

| Tool | Description |
|------|-------------|
| `create_webhook` | Create a webhook with configurable event flags |
| `list_webhooks` | List all webhooks for a project |
| `update_webhook` | Update a webhook's URL, token, or event flags |
| `delete_webhook` | Remove a webhook from a project |
| `test_webhook` | Trigger a test event for a webhook |

### CI/CD Variables

Manage project-level CI/CD variables for environment-specific configuration.

| Tool | Description |
|------|-------------|
| `create_ci_variable` | Create a variable with optional protection, masking, and scoping |
| `list_ci_variables` | List all CI/CD variables for a project |
| `update_ci_variable` | Update a variable's value or flags |
| `delete_ci_variable` | Remove a CI/CD variable |

### Protected Branches

Manage branch protection rules to enforce merge-only workflows.

| Tool | Description |
|------|-------------|
| `protect_branch` | Protect a branch with configurable access levels |
| `list_protected_branches` | List all protected branches |
| `unprotect_branch` | Remove protection from a branch |

### Project Settings

Update project-level configuration for consistent governance across repos.

| Tool | Description |
|------|-------------|
| `update_project_settings` | Update merge method, pipeline requirements, squash options, and more |

### Groups / Subgroups

Manage GitLab groups for namespace isolation.

| Tool | Description |
|------|-------------|
| `create_group` | Create a group or subgroup |
| `list_groups` | List groups with search and access level filters |
| `delete_group` | Delete a group (cascades to all projects within) |

### Project Access Tokens

Manage scoped, rotatable access tokens for cross-repo CI communication.

| Tool | Description |
|------|-------------|
| `create_project_access_token` | Create a scoped token with configurable access level and expiry |
| `list_project_access_tokens` | List all access tokens for a project |
| `revoke_project_access_token` | Revoke an access token |

### Pipeline Trigger Tokens

Manage pipeline trigger tokens for cross-project pipeline triggering.

| Tool | Description |
|------|-------------|
| `create_pipeline_trigger` | Create a pipeline trigger token |
| `list_pipeline_triggers` | List all trigger tokens for a project |
| `delete_pipeline_trigger` | Remove a trigger token |

## Auto-Approve Suggestions

Read-only tools are safe to auto-approve. Mutating tools (create, update, delete) should require confirmation.

```
"autoApprove": [
  "list_webhooks",
  "list_ci_variables",
  "list_protected_branches",
  "list_groups",
  "list_project_access_tokens",
  "list_pipeline_triggers"
]
```

## Self-Hosting

The server ships with a Dockerfile and Fly.io configuration for self-hosting the HTTP transport.

```
fly apps create my-gitlab-ops-mcp
fly deploy
```

The HTTP server runs on port 3000 with a `/health` endpoint for liveness checks. Machines auto-stop when idle and auto-start on incoming requests.

## Relationship to Existing GitLab MCP

The two servers are complementary, not competing:

- **`@zereight/mcp-gitlab`** — developer workspace (repos, branches, MRs, issues, pipelines)
- **`gitlab-ops-mcp`** — project operations (webhooks, variables, protection, settings, tokens)

## Requirements

- Node.js >= 18.0.0

## Licence

MIT
