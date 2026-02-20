# gitlab-ops-mcp

A supplementary MCP server for GitLab that provides the operational and orchestration layer missing from the standard GitLab MCP (`@zereight/mcp-gitlab`).

The existing MCP covers developer workspace operations — repos, files, branches, MRs, issues, pipelines, releases, commits. `gitlab-ops-mcp` covers the automation and project governance layer: webhooks, CI/CD variables, branch protection, project settings, groups, access tokens, and pipeline trigger tokens.

Together they provide complete GitLab API coverage for automated multi-repo project setup and delivery orchestration.

## Installation

Run directly with npx (no install required):

```
npx gitlab-ops-mcp
```

Or install globally:

```
npm install -g gitlab-ops-mcp
```

## Configuration

Add to your MCP client configuration:

```
{
  "mcpServers": {
    "gitlab-ops": {
      "command": "npx",
      "args": ["-y", "gitlab-ops-mcp"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-...",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      },
      "autoApprove": [
        "list_webhooks",
        "list_ci_variables",
        "list_protected_branches",
        "list_groups",
        "list_project_access_tokens",
        "list_pipeline_triggers"
      ]
    }
  }
}
```

Read-only tools (list operations) are safe to auto-approve. Mutating tools (create, update, delete) should require confirmation.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITLAB_PERSONAL_ACCESS_TOKEN` | Yes | — | GitLab personal access token with appropriate scopes |
| `GITLAB_API_URL` | No | `https://gitlab.com/api/v4` | GitLab API v4 base URL |

## Tool Catalogue

21 tools across 7 domains. Each tool is a thin REST wrapper around the GitLab API v4.

### Webhooks

Manage project-level webhooks for event-driven automation.

| Tool | Description |
|------|-------------|
| `create_webhook` | Create a webhook on a project with configurable event flags |
| `list_webhooks` | List all webhooks for a project |
| `update_webhook` | Update an existing webhook's URL, token, or event flags |
| `delete_webhook` | Remove a webhook from a project |
| `test_webhook` | Trigger a test event for a webhook |

### CI/CD Variables

Manage project-level CI/CD variables for environment-specific configuration.

| Tool | Description |
|------|-------------|
| `create_ci_variable` | Create a CI/CD variable with optional protection, masking, and scoping |
| `list_ci_variables` | List all CI/CD variables for a project |
| `update_ci_variable` | Update an existing variable's value or flags |
| `delete_ci_variable` | Remove a CI/CD variable from a project |

### Protected Branches

Manage branch protection rules to enforce merge-only workflows.

| Tool | Description |
|------|-------------|
| `protect_branch` | Protect a branch with configurable access levels and force-push settings |
| `list_protected_branches` | List all protected branches for a project |
| `unprotect_branch` | Remove protection from a branch |

### Project Settings

Update project-level configuration for consistent governance across repos.

| Tool | Description |
|------|-------------|
| `update_project_settings` | Update merge method, pipeline requirements, squash options, and other project settings |

### Groups / Subgroups

Manage GitLab groups for namespace isolation — workshops, demos, team boundaries.

| Tool | Description |
|------|-------------|
| `create_group` | Create a group or subgroup with visibility and description |
| `list_groups` | List groups with optional search, ownership, and access level filters |
| `delete_group` | Delete a group (cascades to all projects within) |

### Project Access Tokens

Manage scoped, rotatable access tokens for cross-repo CI communication.

| Tool | Description |
|------|-------------|
| `create_project_access_token` | Create a scoped access token with configurable access level and expiry |
| `list_project_access_tokens` | List all access tokens for a project |
| `revoke_project_access_token` | Revoke an access token |

### Pipeline Trigger Tokens

Manage pipeline trigger tokens for cross-project pipeline triggering.

| Tool | Description |
|------|-------------|
| `create_pipeline_trigger` | Create a pipeline trigger token |
| `list_pipeline_triggers` | List all trigger tokens for a project |
| `delete_pipeline_trigger` | Remove a trigger token |

## Relationship to Existing GitLab MCP

The two servers are complementary, not competing:

- `@zereight/mcp-gitlab` — developer workspace (what you work with daily)
- `gitlab-ops-mcp` — project operations (what you set up once and automate)

## Requirements

- Node.js >= 18.0.0

## Licence

MIT
